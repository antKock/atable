import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { HouseholdCreateSchema } from '@/lib/schemas/household'
import { generateJoinCode } from '@/lib/auth/join-code'
import { getDeviceName } from '@/lib/auth/device-name'
import { signSession, setSessionCookie, verifySession } from '@/lib/auth/session'
import { resolveOwnerContext } from '@/lib/auth/owner-context'
import { isDemoOwner } from '@/lib/api/with-owner-auth'
import { enforceHouseholdCreateQuota } from '@/lib/import-quota'

export async function POST(request: NextRequest) {
  try {
    // Unauthenticated route, and every new household gets a fresh daily
    // import quota — rate limit per IP to keep both bounded.
    const ip = (request.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
    const quotaResponse = await enforceHouseholdCreateQuota(ip)
    if (quotaResponse) return quotaResponse

    const body = await request.json()
    const result = HouseholdCreateSchema.safeParse(body.name)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 422 }
      )
    }

    const name = result.data
    const joinCode = generateJoinCode()
    // Second lien stable pour le rôle invité (Lot 3, décision n°3). Distinct du
    // lien membre au sein du foyer : un même code ne doit jamais porter deux
    // rôles. Les collisions cross-foyer restent gardées par l'UNIQUE de colonne.
    let guestJoinCode = generateJoinCode()
    while (guestJoinCode === joinCode) guestJoinCode = generateJoinCode()
    const ua = request.headers.get('user-agent') ?? ''
    const deviceName = getDeviceName(ua)

    const supabase = createServerClient()

    // « Créer un foyer » est ADDITIF (Lot 4) : si l'appareil a déjà une session
    // résolvant vers un owner RÉEL (non démo), on crée le foyer et un membership
    // membre sur CET owner — pas de nouvelle session ni de cookie réécrit. Un
    // owner démo (monde gelé) déclenche au contraire une CONVERSION : il retombe
    // sur le chemin « owner neuf » ci-dessous (le membership démo est abandonné).
    const sessionCookie = (await cookies()).get('atable_session')?.value
    const sessionPayload = sessionCookie ? await verifySession(sessionCookie) : null
    const existingOwner = sessionPayload ? await resolveOwnerContext(sessionPayload.sid) : null

    if (existingOwner && !isDemoOwner(existingOwner)) {
      const { data: addHousehold, error: addHouseholdError } = await supabase
        .from('households')
        .insert({ name, join_code: joinCode, guest_join_code: guestJoinCode })
        .select('id')
        .single()
      if (addHouseholdError || !addHousehold) {
        throw new Error(addHouseholdError?.message ?? 'Failed to create household')
      }

      const { error: addMembershipError } = await supabase
        .from('memberships')
        .insert({ owner_id: existingOwner.ownerId, household_id: addHousehold.id, role: 'member' })
      if (addMembershipError) {
        await supabase.from('households').delete().eq('id', addHousehold.id)
        throw new Error(addMembershipError.message)
      }

      // Pas de cookie : la session courante est conservée. Redirection vers la
      // Home (et non le détail/édition du nouveau foyer) : créer un foyer depuis
      // le profil ramène à l'accueil ; le code d'invitation reste accessible sur
      // le détail du foyer.
      return NextResponse.json({ ok: true, redirect: '/home', added: true })
    }

    // Step 1: Insert owner — the abstract identity the household belongs to
    // (chantier foyer #14/#15); the device session below just points at it.
    const { data: owner, error: ownerError } = await supabase
      .from('owners')
      .insert({})
      .select('id')
      .single()

    if (ownerError || !owner) {
      throw new Error(ownerError?.message ?? 'Failed to create owner')
    }
    const ownerId = owner.id

    // Step 2: Insert household
    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert({ name, join_code: joinCode, guest_join_code: guestJoinCode })
      .select('id')
      .single()

    if (householdError || !household) {
      await supabase.from('owners').delete().eq('id', ownerId)
      throw new Error(householdError?.message ?? 'Failed to create household')
    }
    const hid = household.id

    // Step 3: Insert membership (member = lecture + écriture)
    const { error: membershipError } = await supabase
      .from('memberships')
      .insert({ owner_id: ownerId, household_id: hid, role: 'member' })

    if (membershipError) {
      // Compensating deletes — owner delete cascades memberships/sessions
      await supabase.from('households').delete().eq('id', hid)
      await supabase.from('owners').delete().eq('id', ownerId)
      throw new Error(membershipError.message)
    }

    // Step 4: Insert device_session pointing at the owner
    const { data: session, error: sessionError } = await supabase
      .from('device_sessions')
      .insert({ household_id: hid, device_name: deviceName, owner_id: ownerId })
      .select('id')
      .single()

    if (sessionError || !session) {
      await supabase.from('households').delete().eq('id', hid)
      await supabase.from('owners').delete().eq('id', ownerId)
      throw new Error(sessionError?.message ?? 'Failed to create session')
    }
    const sid = session.id

    // Step 5: Migrate existing V1 recipes (household_id IS NULL) to this
    // household. No-op since migration 027 (household_id NOT NULL) — kept for
    // rollback, decommissioned at the end of the chantier foyer.
    const { error: migrateError } = await supabase
      .from('recipes')
      .update({ household_id: hid })
      .is('household_id', null)

    if (migrateError) {
      // Compensating deletes
      await supabase.from('households').delete().eq('id', hid)
      await supabase.from('owners').delete().eq('id', ownerId)
      throw new Error(migrateError.message)
    }

    const token = await signSession({ sid })

    // Cookie on a 200 JSON response (not a 303) — reliable in WKWebView.
    // Redirection Home simple : le hint « partage » de la Home (server-gated)
    // remplace l'ancienne bannière post-création (code d'invitation en clair).
    const response = NextResponse.json({ ok: true, redirect: '/home' })
    setSessionCookie(response, token)

    return response
  } catch (err) {
    // Generic message only: raw Supabase/Postgres errors would leak schema
    // details (constraint and column names) to the client.
    Sentry.captureException(err)
    console.error('[households] caught error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
