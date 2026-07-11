import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { withOwnerAuth, assertNotDemoOwner } from '@/lib/api/with-owner-auth'
import { RecoveryEmailSchema } from '@/lib/schemas/household'
import { recoveryVerifyRateLimit } from '@/lib/redis'
import {
  findOwnerByEmail,
  verifyLoginCode,
  executeMergeOwners,
} from '@/lib/queries/recovery'
import { t } from '@/lib/i18n/fr'

const CODE_REGEX = /^\d{6}$/

// Vérification du code de FUSION (#14, §5) — depuis l'écran « On réunit tes
// foyers » du profil. La session courante = owner SOURCE (absorbé) ; l'owner
// qui porte l'email = CIBLE. Après fusion le cookie reste valide : le sid ne
// change pas, sa session est repointée sur la cible.
export const POST = withOwnerAuth(
  async (request: NextRequest, _context: unknown, owner) => {
    const denied = assertNotDemoOwner(owner)
    if (denied) return denied

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: t.merge.codeInvalid }, { status: 400 })
    }
    const { email: rawEmail, code } = (body ?? {}) as { email?: unknown; code?: unknown }

    const parsedEmail = RecoveryEmailSchema.safeParse(rawEmail)
    if (!parsedEmail.success || typeof code !== 'string' || !CODE_REGEX.test(code)) {
      return NextResponse.json({ error: t.merge.codeInvalid }, { status: 400 })
    }

    // Sans plafond ici, un owner (trivial à obtenir) qui connaît l'email d'une
    // victime pourrait bruteforcer le code de fusion et absorber ses foyers —
    // le compteur d'essais du token ne suffit pas seul. Même limite que
    // /api/recovery/verify.
    const hdrs = await headers()
    const ip = (hdrs.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
    const { success } = await recoveryVerifyRateLimit.limit(ip)
    if (!success) {
      return NextResponse.json({ error: t.recovery.rateLimited }, { status: 429 })
    }

    // Message générique quel que soit l'échec (cible disparue, code faux,
    // token expiré/brûlé) : rien à apprendre de cette route.
    const target = await findOwnerByEmail(parsedEmail.data)
    if (!target || target.id === owner.ownerId) {
      return NextResponse.json({ error: t.merge.codeInvalid }, { status: 400 })
    }

    const valid = await verifyLoginCode(target.id, 'merge', code)
    if (!valid) {
      return NextResponse.json({ error: t.merge.codeInvalid }, { status: 400 })
    }

    await executeMergeOwners(owner.ownerId, target.id)
    return NextResponse.json({ ok: true, redirect: '/household' })
  },
)
