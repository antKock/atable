import { SignJWT, jwtVerify } from 'jose'
import type { SessionPayload } from '@/types/household'

// This is the ONLY file that imports jose directly.

const COOKIE_NAME = 'atable_session'

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SIGNING_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SIGNING_SECRET must be at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ hid: payload.hid, sid: payload.sid, iat: payload.iat })
    .setProtectedHeader({ alg: 'HS256' })
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
  response: { cookies: { set: (opts: object) => void } },
  token: string
): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
}

export function clearSessionCookie(response: {
  cookies: { set: (opts: object) => void }
}): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  })
}

export type { SessionPayload }
