import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import { RecoveryEmailSchema } from '@/lib/schemas/household'
import { recoveryVerifyRateLimit } from '@/lib/redis'
import {
  findOwnerByEmail,
  verifyLoginCode,
  createOwnerSession,
} from '@/lib/queries/recovery'
import { getDeviceName } from '@/lib/auth/device-name'
import { signSession, setSessionCookie } from '@/lib/auth/session'
import { t } from '@/lib/i18n/fr'

const CODE_REGEX = /^\d{6}$/

// Repli code 6 chiffres de la récup (#14, §4) — route PUBLIQUE. Le repli
// existe parce qu'un magic-link ouvert hors du WebView ne pose pas le cookie
// au bon endroit (jar WKWebView ≠ Safari) — ne pas « l'optimiser ».
//
// Message générique unique pour TOUT échec (email inconnu, code faux, token
// expiré/brûlé) : cette route ne doit pas servir d'oracle d'existence.
// Pas de fusion ici : simple reconnexion à l'owner (décision n°6).
export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: t.recovery.codeInvalid }, { status: 400 })
    }
    const { email: rawEmail, code } = (body ?? {}) as { email?: unknown; code?: unknown }

    const parsedEmail = RecoveryEmailSchema.safeParse(rawEmail)
    if (!parsedEmail.success || typeof code !== 'string' || !CODE_REGEX.test(code)) {
      return NextResponse.json({ error: t.recovery.codeInvalid }, { status: 400 })
    }

    const hdrs = await headers()
    const ip = (hdrs.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
    const { success } = await recoveryVerifyRateLimit.limit(ip)
    if (!success) {
      return NextResponse.json({ error: t.recovery.rateLimited }, { status: 429 })
    }

    const owner = await findOwnerByEmail(parsedEmail.data)
    if (!owner) {
      return NextResponse.json({ error: t.recovery.codeInvalid }, { status: 400 })
    }

    const valid = await verifyLoginCode(owner.id, 'recovery', code)
    if (!valid) {
      return NextResponse.json({ error: t.recovery.codeInvalid }, { status: 400 })
    }

    const session = await createOwnerSession(owner.id, getDeviceName(hdrs.get('user-agent') ?? ''))
    if (!session) {
      // Owner sans plus aucun foyer : rien à récupérer — même message générique.
      return NextResponse.json({ error: t.recovery.codeInvalid }, { status: 400 })
    }

    const token = await signSession({ hid: session.householdId, sid: session.sessionId })
    // Cookie sur un 200 JSON (pas un 303) — fiable en WKWebView, comme join.
    const response = NextResponse.json({ ok: true, redirect: '/home' })
    setSessionCookie(response, token)
    return response
  } catch (err) {
    Sentry.captureException(err)
    console.error('[recovery/verify] caught error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
