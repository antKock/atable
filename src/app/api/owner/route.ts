import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { withOwnerAuth } from '@/lib/api/with-owner-auth'
import { OwnerNameSchema } from '@/lib/schemas/household'
import { getT } from '@/lib/i18n/server'
import { parseJsonBody } from '@/lib/api/body'

export const PUT = withOwnerAuth(
  async (request: NextRequest, _context: unknown, owner) => {
    const t = await getT()
    // Stratégie C (« monde gelé ») : le profil d'une session démo est
    // inaccessible — garde par défaut de withOwnerAuth (owner-level).

    // Un corps non-JSON (ou `null`) est une entrée invalide, pas une panne :
    // parseJsonBody répond 400/422 au lieu de laisser remonter un 500.
    const parsed = await parseJsonBody(request, {
      t,
      schema: OwnerNameSchema,
      pick: (b) => (b as { name?: unknown } | null)?.name,
      unreadableMessage: (t) => t.profile.nameInvalid,
      invalidMessage: (t) => t.profile.nameInvalid,
    })
    if (parsed instanceof NextResponse) return parsed

    // Vide → NULL en DB → l'affichage retombe sur l'alias auto (jamais stocké).
    const name = parsed.data.trim() || null

    const supabase = createServerClient()
    const { error } = await supabase
      .from('owners')
      .update({ name })
      .eq('id', owner.ownerId)

    if (error) {
      return NextResponse.json({ error: t.profile.saveError }, { status: 500 })
    }

    // Pas de revalidatePath : /household et /household/profile lisent headers()
    // (getOwnerContext) — toujours dynamiques, jamais en Full Route Cache. Le
    // rafraîchissement visible vient du router.refresh() de ProfileForm.
    return NextResponse.json({ name })
  },
)
