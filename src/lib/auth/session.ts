import { SignJWT, jwtVerify } from 'jose'
import type { NextResponse } from 'next/server'
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
  return new SignJWT({ hid: payload.hid, sid: payload.sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1y')
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const secret = process.env.SESSION_SIGNING_SECRET
    console.log(`[session] verifySession: secret present=${!!secret} secretLength=${secret?.length ?? 0}`)
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    const hid = payload['hid']
    const sid = payload['sid']
    const iat = payload['iat']
    console.log(`[session] jwt decoded: hid=${hid} sid=${sid} iat=${iat}`)
    if (typeof hid !== 'string' || typeof sid !== 'string' || typeof iat !== 'number') {
      console.log(`[session] payload type mismatch: hid=${typeof hid} sid=${typeof sid} iat=${typeof iat}`)
      return null
    }
    return { hid, sid, iat }
  } catch (err) {
    console.error(`[session] jwtVerify threw:`, err)
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
    maxAge: 60 * 60 * 24 * 365,
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
