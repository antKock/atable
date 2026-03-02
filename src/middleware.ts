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
  console.log(`[middleware] → ${pathname}`)

  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  console.log(`[middleware] isPublic=${isPublic}`)

  const token = request.cookies.get('atable_session')?.value
  console.log(`[middleware] cookie present=${!!token} length=${token?.length ?? 0}`)

  let payload = null
  if (token) {
    try {
      payload = await verifySession(token)
      console.log(`[middleware] verifySession=${payload ? `ok hid=${payload.hid} sid=${payload.sid}` : 'null (invalid token)'}`)
    } catch (err) {
      console.error(`[middleware] verifySession threw:`, err)
    }
  }

  // Authenticated user visiting landing → redirect to /home
  if (pathname === '/' && payload) {
    console.log(`[middleware] authenticated on / → redirect /home`)
    return NextResponse.redirect(new URL('/home', request.url))
  }

  if (!isPublic) {
    if (!payload) {
      console.log(`[middleware] no valid session on protected route → redirect /`)
      return NextResponse.redirect(new URL('/', request.url))
    }
    // Check revocation cache
    console.log(`[middleware] calling redis.get(revoked:${payload.sid})`)
    try {
      const isRevoked = await redis.get(`revoked:${payload.sid}`)
      console.log(`[middleware] isRevoked=${JSON.stringify(isRevoked)}`)
      if (isRevoked) {
        console.log(`[middleware] session revoked → redirect /`)
        return NextResponse.redirect(new URL('/', request.url))
      }
    } catch (err) {
      console.error(`[middleware] redis.get threw:`, err)
      // fail-open: continue so we can observe behavior from logs
    }
    // Forward household context via headers
    console.log(`[middleware] forwarding x-household-id=${payload.hid} → next()`)
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-household-id', payload.hid)
    requestHeaders.set('x-session-id', payload.sid)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  console.log(`[middleware] public route → next()`)
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
