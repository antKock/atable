import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { redis } from '@/lib/redis'

// Exact-match public routes (no session required)
const PUBLIC_ROUTES = ['/', '/api/households']
// Prefix-match public routes
const PUBLIC_PREFIXES = [
  '/join/',
  '/legal/',
  '/api/households/lookup',
  '/api/households/join',
  '/api/demo/',
  '/api/auth/session',
  '/api/cron/',
  '/api/admin/',
]

// Bot user-agents used by social platforms to generate link previews
const BOT_UA_PATTERN = /facebookexternalhit|facebookcatalog|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot/i

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Let social media crawlers through so they can read OG metadata
  const userAgent = request.headers.get('user-agent') || ''
  if (BOT_UA_PATTERN.test(userAgent)) {
    return NextResponse.next()
  }

  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  const token = request.cookies.get('atable_session')?.value

  let payload: Awaited<ReturnType<typeof verifySession>> = null
  if (token) {
    try {
      payload = await verifySession(token)
    } catch {
      payload = null
    }
  }

  // Authenticated user visiting landing → redirect to /home
  if (pathname === '/' && payload) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  if (!isPublic) {
    if (!payload) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    try {
      const isRevoked = await redis.get(`revoked:${payload.sid}`)
      if (isRevoked) {
        const res = NextResponse.redirect(new URL('/', request.url))
        res.cookies.set({
          name: 'atable_session',
          value: '',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 0,
          path: '/',
        })
        return res
      }
    } catch {
      // Redis unavailable → fail open, let the request through
    }

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
