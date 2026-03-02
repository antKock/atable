import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { signSession, verifySession } from '@/lib/auth/session'

// TEMPORARY DEBUG ENDPOINT — remove after bug is fixed
export async function GET() {
  const results: Record<string, unknown> = {}

  // 1. Env vars
  results.env = {
    SESSION_SIGNING_SECRET_present: !!process.env.SESSION_SIGNING_SECRET,
    SESSION_SIGNING_SECRET_length: process.env.SESSION_SIGNING_SECRET?.length ?? 0,
    UPSTASH_REDIS_REST_URL_present: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN_present: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    DEMO_HOUSEHOLD_ID_present: !!process.env.DEMO_HOUSEHOLD_ID,
    DEMO_HOUSEHOLD_ID_value: process.env.DEMO_HOUSEHOLD_ID ?? null,
  }

  // 2. Redis connectivity
  try {
    await redis.set('debug:ping', 'pong', { ex: 60 })
    const val = await redis.get('debug:ping')
    results.redis = { ok: true, pingValue: val }
  } catch (err) {
    results.redis = { ok: false, error: String(err) }
  }

  // 3. JWT sign + verify round-trip
  try {
    const testPayload = { hid: 'test-hid', sid: 'test-sid', iat: Math.floor(Date.now() / 1000) }
    const token = await signSession(testPayload)
    const verified = await verifySession(token)
    results.jwt = {
      ok: true,
      tokenLength: token.length,
      verified: verified,
      roundTripMatch: verified?.hid === testPayload.hid && verified?.sid === testPayload.sid,
    }
  } catch (err) {
    results.jwt = { ok: false, error: String(err) }
  }

  return NextResponse.json(results, { status: 200 })
}
