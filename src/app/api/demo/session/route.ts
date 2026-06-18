import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createServerClient } from '@/lib/supabase/server'
import { getDeviceName } from '@/lib/auth/device-name'
import { signSession, setSessionCookie } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  console.log(`[demo/session] POST start`)
  try {
    const demoHouseholdId = process.env.DEMO_HOUSEHOLD_ID
    console.log(`[demo/session] DEMO_HOUSEHOLD_ID present=${!!demoHouseholdId}`)
    if (!demoHouseholdId) {
      return NextResponse.json({ error: 'Demo not configured' }, { status: 503 })
    }

    const ua = request.headers.get('user-agent') ?? ''
    const deviceName = getDeviceName(ua)
    console.log(`[demo/session] deviceName=${deviceName}`)

    const supabase = createServerClient()
    const { data: session, error } = await supabase
      .from('device_sessions')
      .insert({ household_id: demoHouseholdId, device_name: deviceName })
      .select('id')
      .single()

    console.log(`[demo/session] insert session: id=${session?.id} error=${error?.message ?? 'none'}`)

    if (error || !session) {
      throw new Error(error?.message ?? 'Failed to create demo session')
    }

    const payload = { hid: demoHouseholdId, sid: session.id, iat: Math.floor(Date.now() / 1000) }
    const token = await signSession(payload)
    console.log(`[demo/session] token signed, length=${token.length}`)

    // Set the session cookie on a 200 JSON response instead of a 303 redirect:
    // cookies attached to redirects are unreliable in WKWebView. The client
    // reads `redirect` from the body and navigates itself.
    const response = NextResponse.json({ ok: true, redirect: '/home' })
    setSessionCookie(response, token)

    return response
  } catch (err) {
    // Report to Sentry — this used to only console.error, so a 4-week demo
    // outage (deleted demo household → FK violation) went unalerted. Return a
    // generic message rather than leaking the raw DB error to the client.
    Sentry.captureException(err)
    console.error(`[demo/session] caught error:`, err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
