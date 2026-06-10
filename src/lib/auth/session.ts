import { SignJWT, jwtVerify } from 'jose'
import type { NextResponse } from 'next/server'
import type { SessionPayload } from '@/types/household'

// This is the ONLY file that imports jose directly.

const COOKIE_NAME = 'atable_session'

// Sliding session: tokens expire after 6 months, but the middleware re-signs
// any token older than the renewal window on each authenticated request. A
// device only has to re-enter the join code after 6 full months of inactivity.
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 180 // 180 days
export const SESSION_RENEW_AFTER_S = 60 * 60 * 24 * 30 // 30 days

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SIGNING_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SIGNING_SECRET must be at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: Pick<SessionPayload, 'hid' | 'sid'>): Promise<string> {
  return new SignJWT({ hid: payload.hid, sid: payload.sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    const hid = payload['hid']
    const sid = payload['sid']
    const iat = payload['iat']
    if (typeof hid !== 'string' || typeof sid !== 'string' || typeof iat !== 'number') {
      return null
    }
    return { hid, sid, iat }
  } catch {
    return null
  }
}

export function setSessionCookie(
  response: NextResponse,
  token: string
): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE_S,
    path: '/',
  })
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  })
}

export type { SessionPayload }
