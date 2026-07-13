import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { headers, cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { JoinCodeSchema } from '@/lib/schemas/household'
import { resolveInviteCode } from '@/lib/auth/invite-code'
import { joinRateLimit, joinCodeRateLimit } from '@/lib/redis'
import { getDeviceName } from '@/lib/auth/device-name'
import { signSession, setSessionCookie, verifySession } from '@/lib/auth/session'
import { resolveOwnerContext, roleForHousehold, planRoleMerge } from '@/lib/auth/owner-context'
import { isDemoOwner } from '@/lib/api/with-owner-auth'
import { aliasForOwner } from '@/lib/alias'
import { t } from '@/lib/i18n/fr'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = JoinCodeSchema.safeParse(body.code)
    if (!result.success) {
      return NextResponse.json({ error: 'Format de code invalide' }, { status: 400 })
    }

    const hdrs = await headers()
    const ip = (hdrs.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
    const { success } = await joinRateLimit.limit(ip)
    if (!success) {
      return NextResponse.json(
        { error: t.join.rateLimited },
        { status: 429 }
      )
    }

    // Global per-code limit: stops a distributed brute-force that rotates IPs
    const { success: codeAllowed } = await joinCodeRateLimit.limit(result.data)
    if (!codeAllowed) {
      return NextResponse.json(
        { error: t.join.rateLimited },
        { status: 429 }
      )
    }

    const supabase = createServerClient()

    // Résout le code contre les DEUX liens stables du foyer (Lot 3) : join_code
    // → membre, guest_join_code → invité. Le rôle du membership en découle.
    const invite = await resolveInviteCode(supabase, result.data)

    if (!invite) {
      return NextResponse.json(
        { error: 'Ce code ne correspond à aucun carnet' },
        { status: 404 }
      )
    }

    const ua = hdrs.get('user-agent') ?? ''
    const deviceName = getDeviceName(ua)

    // Rejoindre est ADDITIF (Lot 4) : si l'appareil a déjà une session résolvant
    // vers un owner RÉEL (non démo), on ajoute un membership à CET owner — pas
    // de nouvelle session ni de réécriture de cookie. Un owner démo (monde gelé)
    // ne reçoit jamais de membership : il retombe sur le chemin « device neuf »
    // ci-dessous (= sortie de la démo, owner neuf).
    const sessionCookie = (await cookies()).get('atable_session')?.value
    const sessionPayload = sessionCookie ? await verifySession(sessionCookie) : null
    const existingOwner = sessionPayload ? await resolveOwnerContext(sessionPayload.sid) : null

    if (existingOwner && !isDemoOwner(existingOwner)) {
      const currentRole = roleForHousehold(existingOwner, invite.householdId)
      const plan = planRoleMerge(currentRole, invite.role)

      if (plan.action === 'noop') {
        // Déjà membre, code ≤ rôle courant : jamais de rétrogradation.
        return NextResponse.json({ ok: true, redirect: '/household', alreadyMember: true })
      }
      if (plan.action === 'upgrade') {
        const { error: upErr } = await supabase
          .from('memberships')
          .update({ role: plan.role })
          .eq('owner_id', existingOwner.ownerId)
          .eq('household_id', invite.householdId)
        if (upErr) throw new Error(upErr.message)
        return NextResponse.json({ ok: true, redirect: '/household', upgraded: true })
      }
      // action === 'add' : nouveau foyer pour cet owner.
      const { error: addErr } = await supabase
        .from('memberships')
        .insert({ owner_id: existingOwner.ownerId, household_id: invite.householdId, role: plan.role })
      if (addErr) throw new Error(addErr.message)
      return NextResponse.json({ ok: true, redirect: '/household', added: true })
    }

    // Device neuf (aucune session) OU sortie de démo : owner + membership + session.
    // Id généré côté app pour figer le surnom (alias) dès l'insertion (031).
    const ownerId = crypto.randomUUID()
    const { error: ownerError } = await supabase
      .from('owners')
      .insert({ id: ownerId, alias: aliasForOwner(ownerId) })

    if (ownerError) {
      throw new Error(ownerError.message ?? 'Failed to create owner')
    }

    const { error: membershipError } = await supabase
      .from('memberships')
      .insert({ owner_id: ownerId, household_id: invite.householdId, role: invite.role })

    if (membershipError) {
      await supabase.from('owners').delete().eq('id', ownerId)
      throw new Error(membershipError.message)
    }

    const { data: session, error: sessionError } = await supabase
      .from('device_sessions')
      .insert({ household_id: invite.householdId, device_name: deviceName, owner_id: ownerId })
      .select('id')
      .single()

    if (sessionError || !session) {
      // Owner delete cascades the membership
      await supabase.from('owners').delete().eq('id', ownerId)
      throw new Error(sessionError?.message ?? 'Failed to create session')
    }

    const jwt = await signSession({ sid: session.id })

    // Cookie on a 200 JSON response (not a 303) — reliable in WKWebView.
    const response = NextResponse.json({ ok: true, redirect: '/home' })
    setSessionCookie(response, jwt)

    return response
  } catch (err) {
    // Generic message only: raw Supabase/Postgres errors would leak schema
    // details (constraint and column names) to the client.
    Sentry.captureException(err)
    console.error('[households/join] caught error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
