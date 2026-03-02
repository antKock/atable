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
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  const token = request.cookies.get('atable_session')?.value
  const payload = token ? await verifySession(token) : null

  // Authenticated user visiting landing → redirect to /home
  if (pathname === '/' && payload) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  if (!isPublic) {
    if (!payload) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    // Check revocation cache
    const isRevoked = await redis.get(`revoked:${payload.sid}`)
    if (isRevoked) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    // Forward household context via headers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-household-id', payload.hid)
    requestHeaders.set('x-session-id', payload.sid)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
