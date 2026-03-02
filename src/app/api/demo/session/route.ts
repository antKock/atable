import { NextRequest, NextResponse } from 'next/server'
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

    const redirectUrl = new URL('/home', request.url)
    console.log(`[demo/session] redirecting to ${redirectUrl.toString()}`)
    const response = NextResponse.redirect(redirectUrl, { status: 303 })
    setSessionCookie(response, token)
    console.log(`[demo/session] Set-Cookie header=${response.headers.get('set-cookie')?.substring(0, 60)}...`)

    return response
  } catch (err) {
    console.error(`[demo/session] caught error:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
