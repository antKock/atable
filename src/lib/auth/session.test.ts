import { describe, it, expect, beforeEach } from 'vitest'
import { signSession, verifySession, setSessionCookie, clearSessionCookie } from './session'
import type { SessionPayload } from '@/types/household'

const TEST_SECRET = 'test-secret-that-is-at-least-32-chars-long!!'

beforeEach(() => {
  process.env.SESSION_SIGNING_SECRET = TEST_SECRET
})

describe('signSession', () => {
  it('returns a string token', async () => {
    const payload: SessionPayload = { hid: 'hh-1', sid: 'ss-1', iat: Date.now() }
    const token = await signSession(payload)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })
})

describe('verifySession', () => {
  it('round-trips a valid payload', async () => {
    const before = Math.floor(Date.now() / 1000)
    const payload: SessionPayload = { hid: 'hh-abc', sid: 'ss-xyz', iat: before }
    const token = await signSession(payload)
    const result = await verifySession(token)
    const after = Math.floor(Date.now() / 1000)
    expect(result).not.toBeNull()
    expect(result!.hid).toBe('hh-abc')
    expect(result!.sid).toBe('ss-xyz')
    // iat is set by signSession via setIssuedAt() — just verify it's a plausible timestamp
    expect(result!.iat).toBeGreaterThanOrEqual(before)
    expect(result!.iat).toBeLessThanOrEqual(after + 1)
  })

  it('returns null for a tampered token', async () => {
    const payload: SessionPayload = { hid: 'hh-abc', sid: 'ss-xyz', iat: 1234567890 }
    const token = await signSession(payload)
    const tampered = token.slice(0, -5) + 'XXXXX'
    const result = await verifySession(tampered)
    expect(result).toBeNull()
  })

  it('returns null for an empty string', async () => {
    const result = await verifySession('')
    expect(result).toBeNull()
  })

  it('returns null for a garbage string', async () => {
    const result = await verifySession('not.a.jwt')
    expect(result).toBeNull()
  })
})

describe('setSessionCookie', () => {
  it('calls response.cookies.set with correct options', async () => {
    const payload: SessionPayload = { hid: 'hh-1', sid: 'ss-1', iat: Date.now() }
    const token = await signSession(payload)
    const setCalls: object[] = []
    const mockResponse = { cookies: { set: (opts: object) => setCalls.push(opts) } }

    setSessionCookie(mockResponse as never, token)

    expect(setCalls).toHaveLength(1)
    const opts = setCalls[0] as Record<string, unknown>
    expect(opts.name).toBe('atable_session')
    expect(opts.value).toBe(token)
    expect(opts.httpOnly).toBe(true)
    expect(opts.secure).toBe(false) // NODE_ENV is 'test', not 'production'
    expect(opts.sameSite).toBe('lax')
    expect(opts.maxAge).toBe(60 * 60 * 24 * 365)
    expect(opts.path).toBe('/')
  })
})

describe('clearSessionCookie', () => {
  it('calls response.cookies.set with maxAge 0 and empty value', () => {
    const setCalls: object[] = []
    const mockResponse = { cookies: { set: (opts: object) => setCalls.push(opts) } }

    clearSessionCookie(mockResponse as never)

    expect(setCalls).toHaveLength(1)
    const opts = setCalls[0] as Record<string, unknown>
    expect(opts.name).toBe('atable_session')
    expect(opts.value).toBe('')
    expect(opts.maxAge).toBe(0)
    expect(opts.httpOnly).toBe(true)
    expect(opts.secure).toBe(false) // NODE_ENV is 'test', not 'production'
    expect(opts.sameSite).toBe('lax')
  })
})
