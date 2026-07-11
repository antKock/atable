import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import {
  withOwnerAuth,
  requireMember,
  assertNotDemoMutation,
} from '@/lib/api/with-owner-auth'
import { t } from '@/lib/i18n/fr'

type RouteContext = { params: Promise<{ id: string; ownerId: string }> }

const RoleSchema = z.object({ role: z.enum(['member', 'guest']) })

// Gestion des membres d'un foyer (Lot 3, #15a — maquette 2.2). Enforcement
// 100 % applicatif (RLS sans policy). Règles communes PATCH/DELETE :
//   - seul un MEMBRE du foyer gère les membres (requireMember) ;
//   - jamais en démo (monde gelé, garde central) ;
//   - pas d'action sur soi-même (se retirer = « Quitter », route households/[id]) ;
//   - jamais rétrograder/retirer le DERNIER membre (foyer sans membre = ingérable).

// Nombre de memberships 'member' du foyer — sert au garde « dernier membre ».
async function countMembers(
  supabase: ReturnType<typeof createServerClient>,
  householdId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .eq('role', 'member')
  if (error) throw new Error(error.message)
  return count ?? 0
}

// PATCH : changer le rôle d'un membre (membre ⇄ invité).
export const PATCH = withOwnerAuth(
  async (request: NextRequest, { params }: RouteContext, owner) => {
    const { id, ownerId } = await params

    const forbidden = requireMember(owner, id)
    if (forbidden) return forbidden
    const demo = assertNotDemoMutation(owner, id)
    if (demo) return demo

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: t.household.memberAction.roleError }, { status: 400 })
    }
    const parsed = RoleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: t.household.memberAction.roleError }, { status: 400 })
    }
    const nextRole = parsed.data.role

    const supabase = createServerClient()

    // La cible doit être membre de CE foyer.
    const { data: target, error: targetError } = await supabase
      .from('memberships')
      .select('id, role')
      .eq('household_id', id)
      .eq('owner_id', ownerId)
      .maybeSingle()
    if (targetError) throw new Error(targetError.message)
    if (!target) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // No-op explicite (rôle déjà à la valeur voulue) : succès sans garde.
    if (target.role === nextRole) {
      return NextResponse.json({ ok: true })
    }

    // Rétrograder le dernier membre laisserait le foyer sans membre. Ce garde
    // passe AVANT le garde self : se rétrograder soi-même en tant que dernier
    // membre doit répondre 409 (invariant du foyer), pas 403 (spec §4/§5).
    if (nextRole === 'guest' && (await countMembers(supabase, id)) <= 1) {
      return NextResponse.json({ error: t.household.memberAction.lastMember }, { status: 409 })
    }

    // Pas d'action sur soi-même hors dernier membre (se rétrograder = sans objet ;
    // le vrai départ = « Quitter », households/[id] ?action=leave).
    if (ownerId === owner.ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from('memberships')
      .update({ role: nextRole })
      .eq('household_id', id)
      .eq('owner_id', ownerId)
    if (updateError) throw new Error(updateError.message)

    return NextResponse.json({ ok: true })
  },
)

// DELETE : retirer un membre (suppression du membership = accès coupé immédiat).
export const DELETE = withOwnerAuth(
  async (_request: NextRequest, { params }: RouteContext, owner) => {
    const { id, ownerId } = await params

    const forbidden = requireMember(owner, id)
    if (forbidden) return forbidden
    const demo = assertNotDemoMutation(owner, id)
    if (demo) return demo

    const supabase = createServerClient()

    const { data: target, error: targetError } = await supabase
      .from('memberships')
      .select('id, role')
      .eq('household_id', id)
      .eq('owner_id', ownerId)
      .maybeSingle()
    if (targetError) throw new Error(targetError.message)
    if (!target) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Retirer le dernier membre laisserait le foyer ingérable (retirer un
    // invité est toujours permis). Garde AVANT le garde self : le dernier
    // membre qui tente de se retirer doit voir 409 (invariant), pas 403 — il
    // doit passer par « Quitter » (households/[id] ?action=leave) ou supprimer.
    if (target.role === 'member' && (await countMembers(supabase, id)) <= 1) {
      return NextResponse.json({ error: t.household.memberAction.lastMember }, { status: 409 })
    }

    // Pas de self-remove hors dernier membre : le vrai départ = « Quitter »,
    // qui nettoie aussi la session courante de l'appareil.
    if (ownerId === owner.ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from('memberships')
      .delete()
      .eq('household_id', id)
      .eq('owner_id', ownerId)
    if (deleteError) throw new Error(deleteError.message)

    return NextResponse.json({ ok: true })
  },
)
