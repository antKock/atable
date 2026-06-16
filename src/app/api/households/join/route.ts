import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { JoinCodeSchema } from '@/lib/schemas/household'
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

    // Find the household by join code (exclude demo)
    const { data: household, error: lookupError } = await supabase
      .from('households')
      .select('id, name')
      .eq('join_code', result.data)
      .eq('is_demo', false)
      .single()

    if (lookupError || !household) {
      return NextResponse.json(
        { error: 'Ce code ne correspond à aucun foyer' },
        { status: 404 }
      )
    }

    const ua = hdrs.get('user-agent') ?? ''
    const deviceName = getDeviceName(ua)

    const { data: session, error: sessionError } = await supabase
      .from('device_sessions')
      .insert({ household_id: household.id, device_name: deviceName })
      .select('id')
      .single()

    if (sessionError || !session) {
      throw new Error(sessionError?.message ?? 'Failed to create session')
    }

    const payload = { hid: household.id, sid: session.id, iat: Math.floor(Date.now() / 1000) }
    const token = await signSession(payload)

    // Cookie on a 200 JSON response (not a 303) — reliable in WKWebView.
    const response = NextResponse.json({ ok: true, redirect: '/home' })
    setSessionCookie(response, token)

    return response
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
