import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { JoinCodeSchema } from '@/lib/schemas/household'
import { resolveInviteCode } from '@/lib/auth/invite-code'
import { joinRateLimit, joinCodeRateLimit } from '@/lib/redis'
import { getDeviceName } from '@/lib/auth/device-name'
import { signSession, setSessionCookie } from '@/lib/auth/session'
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
        { error: 'Ce code ne correspond à aucun foyer' },
        { status: 404 }
      )
    }

    const ua = hdrs.get('user-agent') ?? ''
    const deviceName = getDeviceName(ua)

    // Owner neuf + membership (rôle porté par le code) + session (chantier
    // foyer #14/#15). Un device qui « change de foyer » crée donc un owner
    // neuf — comportement actuel conservé ; l'additivité arrive au Lot 4.
    const { data: owner, error: ownerError } = await supabase
      .from('owners')
      .insert({})
      .select('id')
      .single()

    if (ownerError || !owner) {
      throw new Error(ownerError?.message ?? 'Failed to create owner')
    }

    const { error: membershipError } = await supabase
      .from('memberships')
      .insert({ owner_id: owner.id, household_id: invite.householdId, role: invite.role })

    if (membershipError) {
      await supabase.from('owners').delete().eq('id', owner.id)
      throw new Error(membershipError.message)
    }

    const { data: session, error: sessionError } = await supabase
      .from('device_sessions')
      .insert({ household_id: invite.householdId, device_name: deviceName, owner_id: owner.id })
      .select('id')
      .single()

    if (sessionError || !session) {
      // Owner delete cascades the membership
      await supabase.from('owners').delete().eq('id', owner.id)
      throw new Error(sessionError?.message ?? 'Failed to create session')
    }

    const payload = { hid: invite.householdId, sid: session.id, iat: Math.floor(Date.now() / 1000) }
    const token = await signSession(payload)

    // Cookie on a 200 JSON response (not a 303) — reliable in WKWebView.
    const response = NextResponse.json({ ok: true, redirect: '/home' })
    setSessionCookie(response, token)

    return response
  } catch (err) {
    // Generic message only: raw Supabase/Postgres errors would leak schema
    // details (constraint and column names) to the client.
    Sentry.captureException(err)
    console.error('[households/join] caught error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
