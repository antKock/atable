'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { HouseholdCreateSchema, JoinCodeSchema } from '@/lib/schemas/household'
import { generateJoinCode } from '@/lib/auth/join-code'
import { getDeviceName } from '@/lib/auth/device-name'
import { signSession } from '@/lib/auth/session'
import { joinRateLimit } from '@/lib/redis'

const COOKIE_NAME = 'atable_session'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 365,
  path: '/',
}

async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS)
}

// ── Demo ──────────────────────────────────────────────────────────────────────

export async function startDemoSession() {
  const demoHouseholdId = process.env.DEMO_HOUSEHOLD_ID
  if (!demoHouseholdId) throw new Error('Demo not configured')

  const hdrs = await headers()
  const ua = hdrs.get('user-agent') ?? ''
  const deviceName = getDeviceName(ua)

  const supabase = createServerClient()
  const { data: session, error } = await supabase
    .from('device_sessions')
    .insert({ household_id: demoHouseholdId, device_name: deviceName })
    .select('id')
    .single()

  if (error || !session) throw new Error('Failed to create demo session')

  const payload = { hid: demoHouseholdId, sid: session.id, iat: Math.floor(Date.now() / 1000) }
  const token = await signSession(payload)
  await setSessionCookie(token)

  redirect('/home')
}

// ── Create household ──────────────────────────────────────────────────────────

export type CreateHouseholdState = { error: string } | null

export async function createHousehold(
  _prev: CreateHouseholdState,
  formData: FormData
): Promise<CreateHouseholdState> {
  const result = HouseholdCreateSchema.safeParse(formData.get('name'))
  if (!result.success) return { error: result.error.issues[0].message }

  const name = result.data
  const joinCode = generateJoinCode()

  const hdrs = await headers()
  const ua = hdrs.get('user-agent') ?? ''
  const deviceName = getDeviceName(ua)

  const supabase = createServerClient()

  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({ name, join_code: joinCode })
    .select('id')
    .single()

  if (householdError || !household) return { error: householdError?.message ?? 'Failed to create household' }
  const hid = household.id

  const { data: sessionData, error: sessionError } = await supabase
    .from('device_sessions')
    .insert({ household_id: hid, device_name: deviceName })
    .select('id')
    .single()

  if (sessionError || !sessionData) {
    await supabase.from('households').delete().eq('id', hid)
    return { error: sessionError?.message ?? 'Failed to create session' }
  }

  const { error: migrateError } = await supabase
    .from('recipes')
    .update({ household_id: hid })
    .is('household_id', null)

  if (migrateError) {
    await supabase.from('households').delete().eq('id', hid)
    return { error: migrateError.message }
  }

  const payload = { hid, sid: sessionData.id, iat: Math.floor(Date.now() / 1000) }
  const token = await signSession(payload)
  await setSessionCookie(token)

  redirect(`/home?code=${encodeURIComponent(joinCode)}&householdName=${encodeURIComponent(name)}`)
}

// ── Join household ────────────────────────────────────────────────────────────

export type JoinHouseholdState = { error: string; status?: number } | null

export async function joinHousehold(
  _prev: JoinHouseholdState,
  formData: FormData
): Promise<JoinHouseholdState> {
  const result = JoinCodeSchema.safeParse(formData.get('code'))
  if (!result.success) return { error: 'Format de code invalide' }

  const hdrs = await headers()
  const ip = (hdrs.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
  const { success } = await joinRateLimit.limit(ip)
  if (!success) return { error: 'Trop de tentatives, réessayez plus tard', status: 429 }

  const supabase = createServerClient()

  const { data: household, error: lookupError } = await supabase
    .from('households')
    .select('id, name')
    .eq('join_code', result.data)
    .eq('is_demo', false)
    .single()

  if (lookupError || !household) return { error: 'Ce code ne correspond à aucun foyer' }

  const ua = hdrs.get('user-agent') ?? ''
  const deviceName = getDeviceName(ua)

  const { data: sessionData, error: sessionError } = await supabase
    .from('device_sessions')
    .insert({ household_id: household.id, device_name: deviceName })
    .select('id')
    .single()

  if (sessionError || !sessionData) return { error: sessionError?.message ?? 'Failed to create session' }

  const payload = { hid: household.id, sid: sessionData.id, iat: Math.floor(Date.now() / 1000) }
  const token = await signSession(payload)
  await setSessionCookie(token)

  redirect('/home')
}
