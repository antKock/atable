import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import { RecoveryEmailSchema } from '@/lib/schemas/household'
import { recoveryIpRateLimit, recoveryEmailRateLimit } from '@/lib/redis'
import { findOwnerByEmail, createLoginToken } from '@/lib/queries/recovery'
import { sendRecoveryEmail } from '@/lib/email/send'
import { t } from '@/lib/i18n/fr'

// Demande de récupération (#14, §4) — route PUBLIQUE (middleware).
//
// ANTI-ÉNUMÉRATION STRICTE : la réponse est un 200 identique que l'email
// existe ou non (timing best effort). Même un échec du chemin « email
// connu » (DB, envoi) répond 200 : un 500 réservé aux adresses existantes
// serait un oracle. Les erreurs partent dans Sentry, pas dans la réponse.
export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: t.profile.emailInvalid }, { status: 400 })
    }
    const parsed = RecoveryEmailSchema.safeParse((body as { email?: unknown } | null)?.email)
    if (!parsed.success) {
      // Erreur de FORMAT : indépendante de l'existence, sûre à révéler.
      return NextResponse.json({ error: t.profile.emailInvalid }, { status: 400 })
    }
    const email = parsed.data

    const hdrs = await headers()
    const ip = (hdrs.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
    const { success: ipAllowed } = await recoveryIpRateLimit.limit(ip)
    if (!ipAllowed) {
      return NextResponse.json({ error: t.recovery.rateLimited }, { status: 429 })
    }
    // Par adresse, que l'email existe OU NON : un 429 sélectif serait un oracle.
    const { success: emailAllowed } = await recoveryEmailRateLimit.limit(email)
    if (!emailAllowed) {
      return NextResponse.json({ error: t.recovery.rateLimited }, { status: 429 })
    }

    try {
      const owner = await findOwnerByEmail(email)
      if (owner) {
        const { token, code } = await createLoginToken(owner.id, 'recovery')
        await sendRecoveryEmail(email, {
          magicLink: `${request.nextUrl.origin}/recover/${token}`,
          code,
          kind: 'recovery',
        })
      }
    } catch (err) {
      Sentry.captureException(err)
      console.error('[recovery/request] échec du chemin email connu (réponse 200 conservée) :', err)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    Sentry.captureException(err)
    console.error('[recovery/request] caught error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
