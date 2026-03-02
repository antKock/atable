import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { HouseholdCreateSchema } from '@/lib/schemas/household'
import { generateJoinCode } from '@/lib/auth/join-code'
import { getDeviceName } from '@/lib/auth/device-name'
import { signSession, setSessionCookie } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  try {
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
    const ua = request.headers.get('user-agent') ?? ''
    const deviceName = getDeviceName(ua)

    const supabase = createServerClient()

    // Step 1: Insert household
    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert({ name, join_code: joinCode })
      .select('id')
      .single()

    if (householdError || !household) {
      throw new Error(householdError?.message ?? 'Failed to create household')
    }
    const hid = household.id

    // Step 2: Insert device_session
    const { data: session, error: sessionError } = await supabase
      .from('device_sessions')
      .insert({ household_id: hid, device_name: deviceName })
      .select('id')
      .single()

    if (sessionError || !session) {
      // Compensating delete — CASCADE handles device_sessions
      await supabase.from('households').delete().eq('id', hid)
      throw new Error(sessionError?.message ?? 'Failed to create session')
    }
    const sid = session.id

    // Step 3: Migrate existing V1 recipes (household_id IS NULL) to this household
    const { error: migrateError } = await supabase
      .from('recipes')
      .update({ household_id: hid })
      .is('household_id', null)

    if (migrateError) {
      // Compensating delete
      await supabase.from('households').delete().eq('id', hid)
      throw new Error(migrateError.message)
    }

    const payload = { hid, sid, iat: Math.floor(Date.now() / 1000) }
    const token = await signSession(payload)

    const redirectUrl = new URL(
      `/home?code=${encodeURIComponent(joinCode)}&householdName=${encodeURIComponent(name)}`,
      request.url
    )
    const response = NextResponse.redirect(redirectUrl, { status: 303 })
    setSessionCookie(response, token)

    return response
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
