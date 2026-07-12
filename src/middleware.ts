import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  verifySession,
  signSession,
  setSessionCookie,
  SESSION_RENEW_AFTER_S,
} from '@/lib/auth/session'
import { redis } from '@/lib/redis'

// Exact-match public routes (no session required)
const PUBLIC_ROUTES = ['/', '/support', '/api/households', '/api/version']
// Prefix-match public routes
const PUBLIC_PREFIXES = [
  '/join/',
  '/r/',
  '/recover/',
  '/api/recovery/',
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
    } catch (err) {
      // Redis unavailable → fail open, let the request through
      console.error('[middleware] revocation check failed (Redis down?), failing open:', err)
    }

    const requestHeaders = new Headers(request.headers)
    // Décommissionnement du chantier foyer (Lot 4) : plus de `x-household-id` —
    // le `sid` est l'unique clé, le foyer se résout en DB (owner-context). Seul
    // `x-session-id` est injecté. (Les hints ne dépendent plus de `x-pathname` :
    // ils sont rendus directement dans la page /home via `HomeHints`.)
    requestHeaders.set('x-session-id', payload.sid)
    const response = NextResponse.next({ request: { headers: requestHeaders } })

    // Sliding renewal: re-sign tokens older than the renewal window so active
    // devices never hit the absolute expiry. Only inactivity for the full
    // session lifetime forces re-entering the join code.
    const tokenAgeS = Math.floor(Date.now() / 1000) - payload.iat
    if (tokenAgeS > SESSION_RENEW_AFTER_S) {
      try {
        const fresh = await signSession({ sid: payload.sid })
        setSessionCookie(response, fresh)
      } catch {
        // Renewal is best-effort; the current token is still valid.
      }
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|.*\\..*).*)'],
}
