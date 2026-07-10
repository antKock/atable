import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { withOwnerAuth, assertNotDemoMutation } from '@/lib/api/with-owner-auth'
import { OwnerNameSchema } from '@/lib/schemas/household'

export const PUT = withOwnerAuth(
  async (request: NextRequest, _context: unknown, owner) => {
    // Stratégie C (« monde gelé ») : le profil d'une session démo est
    // inaccessible — toute mutation est refusée par le guard central.
    for (const membership of owner.memberships) {
      const denied = assertNotDemoMutation(owner, membership.householdId)
      if (denied) return denied
    }

    const body = await request.json()
    const parsed = OwnerNameSchema.safeParse(body.name)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }

    // Vide → NULL en DB → l'affichage retombe sur l'alias auto (jamais stocké).
    const name = parsed.data.trim() || null

    const supabase = createServerClient()
    const { error } = await supabase
      .from('owners')
      .update({ name })
      .eq('id', owner.ownerId)

    if (error) {
      return NextResponse.json({ error: 'Failed to update name' }, { status: 500 })
    }

    revalidatePath('/household')
    revalidatePath('/household/profile')
    return NextResponse.json({ name })
  },
)
