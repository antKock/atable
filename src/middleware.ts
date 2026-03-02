import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { redis } from '@/lib/redis'

// Exact-match public routes (no session required)
const PUBLIC_ROUTES = ['/', '/api/households']
// Prefix-match public routes
const PUBLIC_PREFIXES = [
  '/join/',
  '/api/households/lookup',
  '/api/households/join',
  '/api/demo/',
  '/api/auth/session',
  '/api/cron/',
  '/api/debug',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  const token = request.cookies.get('atable_session')?.value

  let payload: Awaited<ReturnType<typeof verifySession>> = null
  let verifyError = ''
  if (token) {
    try {
      payload = await verifySession(token)
      if (!payload) verifyError = 'returned-null'
    } catch (err) {
      verifyError = String(err)
    }
  }

  // Helper: attach debug headers to any response
  function withDebug(res: NextResponse, extra?: Record<string, string>) {
    res.headers.set('x-dbg-cookie', token ? `yes:${token.length}` : 'no')
    res.headers.set('x-dbg-payload', payload ? `ok:${payload.hid.slice(0, 8)}` : `null:${verifyError}`)
    if (extra) {
      for (const [k, v] of Object.entries(extra)) res.headers.set(k, v)
    }
    return res
  }

  // Authenticated user visiting landing → redirect to /home
  if (pathname === '/' && payload) {
    return withDebug(NextResponse.redirect(new URL('/home', request.url)), { 'x-dbg-action': 'redirect-home' })
  }

  if (!isPublic) {
    if (!payload) {
      return withDebug(NextResponse.redirect(new URL('/', request.url)), { 'x-dbg-action': 'redirect-landing:no-payload' })
    }

    let redisResult = 'skip'
    try {
      const isRevoked = await redis.get(`revoked:${payload.sid}`)
      redisResult = isRevoked ? 'revoked' : 'ok'
      if (isRevoked) {
        return withDebug(NextResponse.redirect(new URL('/', request.url)), { 'x-dbg-action': 'redirect-landing:revoked', 'x-dbg-redis': redisResult })
      }
    } catch (err) {
      redisResult = `error:${String(err).slice(0, 80)}`
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-household-id', payload.hid)
    requestHeaders.set('x-session-id', payload.sid)
    return withDebug(
      NextResponse.next({ request: { headers: requestHeaders } }),
      { 'x-dbg-action': 'next:ok', 'x-dbg-redis': redisResult }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
