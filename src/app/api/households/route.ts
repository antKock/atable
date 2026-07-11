import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createServerClient } from '@/lib/supabase/server'
import { HouseholdCreateSchema } from '@/lib/schemas/household'
import { generateJoinCode } from '@/lib/auth/join-code'
import { getDeviceName } from '@/lib/auth/device-name'
import { signSession, setSessionCookie } from '@/lib/auth/session'
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

    const payload = { hid, sid, iat: Math.floor(Date.now() / 1000) }
    const token = await signSession(payload)

    // Cookie on a 200 JSON response (not a 303) — reliable in WKWebView.
    const redirect = `/home?code=${encodeURIComponent(joinCode)}&householdName=${encodeURIComponent(name)}`
    const response = NextResponse.json({ ok: true, redirect })
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
