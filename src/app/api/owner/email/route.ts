import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { withOwnerAuth, assertNotDemoOwner } from '@/lib/api/with-owner-auth'
import { RecoveryEmailSchema } from '@/lib/schemas/household'
import { recoveryEmailRateLimit, recoveryIpRateLimit } from '@/lib/redis'
import { createLoginToken } from '@/lib/queries/recovery'
import { sendRecoveryEmail } from '@/lib/email/send'
import { t } from '@/lib/i18n/fr'

// Email de secours (#14, maquette 0.3) : saisi au profil, AUCUN envoi à la
// saisie. Seule exception : la collision — email déjà porté par un autre
// owner → départ du flow fusion (§5), token purpose='merge' vers l'owner
// CIBLE + email de vérification. La fuite d'existence côté profil est assumée
// (décision n°6) ; l'anti-énumération stricte ne vaut que pour la récup.
export const PUT = withOwnerAuth(
  async (request: NextRequest, _context: unknown, owner) => {
    // Stratégie C : profil gelé pour les sessions démo — owner-level, comme
    // PUT /api/owner.
    const denied = assertNotDemoOwner(owner)
    if (denied) return denied

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: t.profile.emailInvalid }, { status: 400 })
    }
    const raw = (body as { email?: unknown } | null)?.email

    // Vide → retirer l'email (symétrique du nom : NULL en DB)
    if (typeof raw === 'string' && raw.trim() === '') {
      const { error } = await createServerClient()
        .from('owners')
        .update({ recovery_email: null })
        .eq('id', owner.ownerId)
      if (error) {
        return NextResponse.json({ error: t.profile.saveError }, { status: 500 })
      }
      return NextResponse.json({ email: null })
    }

    const parsed = RecoveryEmailSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: t.profile.emailInvalid }, { status: 400 })
    }
    const email = parsed.data
    if (email === owner.recoveryEmail) {
      return NextResponse.json({ email })
    }

    // La décision n°6 assume la fuite d'existence côté profil (email pris →
    // { merge: true }), mais pas son exploitation en masse : sans plafond, un
    // owner authentifié scripterait l'énumération d'un carnet d'adresses. Posé
    // AVANT le lookup, donc identique sur les deux issues.
    const hdrs = await headers()
    const ip = (hdrs.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
    const { success: ipAllowed } = await recoveryIpRateLimit.limit(ip)
    if (!ipAllowed) {
      return NextResponse.json({ error: t.recovery.rateLimited }, { status: 429 })
    }

    const supabase = createServerClient()
    const { data: holder, error: lookupError } = await supabase
      .from('owners')
      .select('id')
      .eq('recovery_email', email)
      .maybeSingle()
    if (lookupError) {
      return NextResponse.json({ error: t.profile.saveError }, { status: 500 })
    }

    if (holder && holder.id !== owner.ownerId) {
      // Collision → fusion. Même plafond par adresse que la récup : cette
      // route authentifiée enverrait sinon des emails arbitraires en boucle.
      const { success } = await recoveryEmailRateLimit.limit(email)
      if (!success) {
        return NextResponse.json({ error: t.recovery.rateLimited }, { status: 429 })
      }
      const { token, code } = await createLoginToken(holder.id, 'merge')
      await sendRecoveryEmail(email, {
        magicLink: `${request.nextUrl.origin}/recover/${token}`,
        code,
        kind: 'merge',
      })
      // L'email n'est PAS posé sur l'owner courant : il appartient à la cible.
      return NextResponse.json({ merge: true })
    }

    const { error } = await supabase
      .from('owners')
      .update({ recovery_email: email })
      .eq('id', owner.ownerId)
    if (error) {
      // Course possible : UNIQUE posé entre le lookup et l'update — le retry
      // utilisateur retombera sur le chemin fusion.
      return NextResponse.json({ error: t.profile.saveError }, { status: 500 })
    }
    return NextResponse.json({ email })
  },
)
