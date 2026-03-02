import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getDeviceName } from '@/lib/auth/device-name'
import { signSession, setSessionCookie } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  try {
    const demoHouseholdId = process.env.DEMO_HOUSEHOLD_ID
    if (!demoHouseholdId) {
      return NextResponse.json({ error: 'Demo not configured' }, { status: 503 })
    }

    const ua = request.headers.get('user-agent') ?? ''
    const deviceName = getDeviceName(ua)

    const supabase = createServerClient()
    const { data: session, error } = await supabase
      .from('device_sessions')
      .insert({ household_id: demoHouseholdId, device_name: deviceName })
      .select('id')
      .single()

    if (error || !session) {
      throw new Error(error?.message ?? 'Failed to create demo session')
    }

    const payload = { hid: demoHouseholdId, sid: session.id, iat: Math.floor(Date.now() / 1000) }
    const token = await signSession(payload)

    const response = NextResponse.json({ ok: true })
    setSessionCookie(response, token)

    return response
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
