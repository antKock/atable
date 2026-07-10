import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import { redis, recoveryVerifyRateLimit } from '@/lib/redis'
import {
  consumeMagicToken,
  createOwnerSession,
  executeMergeOwners,
} from '@/lib/queries/recovery'
import { resolveOwnerContext } from '@/lib/auth/owner-context'
import { getDeviceName } from '@/lib/auth/device-name'
import { signSession, verifySession, setSessionCookie } from '@/lib/auth/session'
import { t } from '@/lib/i18n/fr'

// Alphabet share-token, longueur défensive large : le vrai filtre est le hash.
const TOKEN_REGEX = /^[2-9A-HJ-NP-Za-km-np-z]{8,64}$/

// Consommation du magic-link /recover/<token> (#14) — route PUBLIQUE, appelée
// par la page GET /recover/[token]. Single-use (claim atomique en DB).
//
//   - purpose 'recovery' : nouvelle session sur l'owner du token + cookie →
//     /home. L'ancien appareil coexiste (aucune invalidation).
//   - purpose 'merge' : la session COURANTE du device (cookie lu à la main —
//     route publique, pas de x-session-id) est la source, l'owner du token la
//     cible → fusion, cookie intact (sid repointé). Sans session source
//     (mail ouvert ailleurs, session démo) : simple reconnexion à la cible.
export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: t.recovery.consumeErrorTitle }, { status: 400 })
    }
    const token = (body as { token?: unknown } | null)?.token
    if (typeof token !== 'string' || !TOKEN_REGEX.test(token)) {
      return NextResponse.json({ error: t.recovery.consumeErrorTitle }, { status: 400 })
    }

    const hdrs = await headers()
    const ip = (hdrs.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
    const { success } = await recoveryVerifyRateLimit.limit(ip)
    if (!success) {
      return NextResponse.json({ error: t.recovery.rateLimited }, { status: 429 })
    }

    const consumed = await consumeMagicToken(token)
    if (!consumed) {
      return NextResponse.json({ error: t.recovery.consumeErrorTitle }, { status: 400 })
    }

    if (consumed.purpose === 'merge') {
      // Route publique : le middleware ne passe pas ici, donc ni x-session-id
      // ni le check de révocation Redis. On refait les deux à la main — une
      // session révoquée ne doit pas servir de source de fusion.
      const raw = request.cookies.get('atable_session')?.value
      const payload = raw ? await verifySession(raw) : null
      const revoked = payload ? await redis.get(`revoked:${payload.sid}`) : null
      const source = payload && !revoked ? await resolveOwnerContext(payload.sid) : null
      const sourceIsDemo = source?.memberships.some((m) => m.isDemo) ?? false
      if (source && source.ownerId !== consumed.ownerId && !sourceIsDemo) {
        await executeMergeOwners(source.ownerId, consumed.ownerId)
        // La session courante vient d'être repointée sur la cible : cookie
        // inchangé, le hub montre l'union.
        return NextResponse.json({ ok: true, redirect: '/household' })
      }
      // Pas de source à fusionner → reconnexion à la cible, comme une récup.
    }

    const session = await createOwnerSession(
      consumed.ownerId,
      getDeviceName(hdrs.get('user-agent') ?? ''),
    )
    if (!session) {
      return NextResponse.json({ error: t.recovery.consumeErrorTitle }, { status: 400 })
    }
    const jwt = await signSession({ hid: session.householdId, sid: session.sessionId })
    const response = NextResponse.json({
      ok: true,
      redirect: consumed.purpose === 'merge' ? '/household' : '/home',
    })
    setSessionCookie(response, jwt)
    return response
  } catch (err) {
    Sentry.captureException(err)
    console.error('[recovery/consume] caught error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
