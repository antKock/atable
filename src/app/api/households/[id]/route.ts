import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { HouseholdCreateSchema } from '@/lib/schemas/household'
import { clearSessionCookie } from '@/lib/auth/session'
import {
  withOwnerAuth,
  requireMember,
  assertNotDemoMutation,
} from '@/lib/api/with-owner-auth'
import { t } from '@/lib/i18n/fr'

type RouteContext = { params: Promise<{ id: string }> }

export const PUT = withOwnerAuth(
  async (request: NextRequest, { params }: RouteContext, owner) => {
    const { id } = await params

    // Le foyer visé est celui de l'URL, validé contre les memberships de
    // l'owner (et non memberships[0]) : le détail de foyer est déjà multi-foyer.
    const forbidden = requireMember(owner, id)
    if (forbidden) return forbidden

    // Le foyer démo est du contenu partagé : le readOnly de l'UI ne protège
    // rien côté serveur (leçon de l'incident 2026-06 — garde central).
    const demo = assertNotDemoMutation(owner, id)
    if (demo) return demo

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: t.household.renameError }, { status: 400 })
    }

    const parsed = HouseholdCreateSchema.safeParse((body as { name?: unknown } | null)?.name)
    if (!parsed.success) {
      return NextResponse.json({ error: t.household.renameError }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('households')
      .update({ name: parsed.data })
      .eq('id', id)
      .select('id, name')
      .single()

    if (error) {
      return NextResponse.json({ error: t.household.renameError }, { status: 500 })
    }

    // Pas de revalidatePath : /household et /household/[id] lisent headers()
    // (getOwnerContext) — toujours dynamiques, rendues à chaque requête.
    return NextResponse.json({ id: data.id, name: data.name })
  },
)

export const DELETE = withOwnerAuth(
  async (request: NextRequest, { params }: RouteContext, owner) => {
    const { id } = await params

    // Le foyer visé est celui de l'URL, validé contre les memberships de
    // l'owner. Quitter reste ouvert aux invités (Lot 3) : pas de requireMember.
    const membership = owner.memberships.find((m) => m.householdId === id)
    const { ownerId, sessionId } = owner

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const householdId = id

    // Multi-foyer (Lot 4) : quitter/supprimer UN foyer parmi N ne déconnecte
    // pas. S'il reste ≥1 membership après l'opération, la session est CONSERVÉE
    // et on renvoie vers le hub — pas la landing, pas de cookie invalidé.
    const remaining = owner.memberships.filter((m) => m.householdId !== id)
    const stayLoggedIn = remaining.length > 0

    // Explicit intent — the UI exposes two distinct actions:
    //   leave  → this device leaves; the household and its data are kept
    //   delete → the household and all its recipes/sessions are destroyed
    const action = request.nextUrl.searchParams.get('action')
    if (action !== 'leave' && action !== 'delete') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const supabase = createServerClient()

    if (action === 'delete') {
      // Supprimer un foyer (destruction cascade des recettes/membres/sessions de
      // TOUS) est réservé aux MEMBRES : un invité (lecture seule) est refusé
      // 403. Le masquage UI (LeaveHouseholdDialog canDelete) ne suffit pas — la
      // sécurité est serveur (RLS sans policy). « Quitter » reste ouvert aux
      // invités (branche else, pas de requireMember).
      const forbidden = requireMember(owner, householdId)
      if (forbidden) return forbidden

      // The demo household is shared sample content, not a user's own data — a
      // demo session must not be able to destroy it for everyone (which has
      // happened: the whole demo was wiped this way). 'leave' still works, so
      // Apple 5.1.1(v) — delete *your* data — stays satisfied. `isDemo` vient du
      // contexte owner (résolu en DB) : pas de requête supplémentaire.
      if (membership.isDemo) {
        return NextResponse.json(
          { error: 'Le foyer démo ne peut pas être supprimé.' },
          { status: 403 },
        )
      }

      // Si l'owner reste membre d'autres foyers, on repointe D'ABORD la session
      // de CET appareil vers un foyer survivant : device_sessions.household_id
      // porte encore une FK ON DELETE CASCADE (colonne vestigiale), donc sans ce
      // repointage la suppression du foyer courant détruirait la session et
      // déconnecterait un owner multi-foyer. (hid décommissionné : rien ne scope
      // sur cette colonne, elle ne sert qu'à garder la session vivante.)
      if (stayLoggedIn) {
        const { error: repointError } = await supabase
          .from('device_sessions')
          .update({ household_id: remaining[0].householdId })
          .eq('id', sessionId)
        // Si le repointage échoue, ne PAS lancer la cascade : elle détruirait la
        // session (FK) et déconnecterait à tort un owner multi-foyer.
        if (repointError) {
          return NextResponse.json({ error: 'Failed to delete household' }, { status: 500 })
        }
      }

      // Purge Storage files first — the DB row delete cascade won't reach them.
      // Apple 5.1.1(v) requires effective server-side data deletion.
      const { data: recipesToDelete } = await supabase
        .from('recipes')
        .select('photo_url, generated_image_url')
        .eq('household_id', householdId)
      if (recipesToDelete && recipesToDelete.length > 0) {
        const paths: string[] = []
        for (const r of recipesToDelete) {
          for (const url of [r.photo_url, r.generated_image_url]) {
            if (url) {
              // `[^?]+` et pas `(.+)$` : les URLs portent un cache-buster
              // `?v=timestamp` (photo/route + enrichment) — le capturer donnerait
              // une clé Storage inexistante et `remove()` no-op (images orphelines).
              const match = (url as string).match(/recipe-photos\/([^?]+)/)
              if (match) paths.push(decodeURIComponent(match[1]))
            }
          }
        }
        if (paths.length > 0) {
          await supabase.storage.from('recipe-photos').remove(paths)
        }
      }
      // Delete household — since migration 027 the CASCADE reaches recipes,
      // memberships and device_sessions (owner rows of other devices remain:
      // an owner is an identity, not an access).
      const { error: householdError } = await supabase
        .from('households')
        .delete()
        .eq('id', householdId)
      if (householdError) {
        return NextResponse.json({ error: 'Failed to delete household' }, { status: 500 })
      }
    } else {
      // action === 'leave' — drop the owner's membership on this foyer.
      const { error: membershipError } = await supabase
        .from('memberships')
        .delete()
        .eq('owner_id', ownerId)
        .eq('household_id', householdId)
      if (membershipError) {
        return NextResponse.json({ error: 'Failed to leave household' }, { status: 500 })
      }
      // Dernier foyer quitté → on supprime aussi la session de cet appareil
      // (déconnexion). S'il reste des foyers, la session survit : le foyer
      // n'étant PAS supprimé, device_sessions.household_id (même s'il pointait
      // vers ce foyer) reste une FK valide — rien à repointer.
      if (!stayLoggedIn) {
        const { error: sessionError } = await supabase
          .from('device_sessions')
          .delete()
          .eq('id', sessionId)
        if (sessionError) {
          return NextResponse.json({ error: 'Failed to leave household' }, { status: 500 })
        }
      }
    }

    // Il reste ≥1 foyer : session conservée, retour au hub, cookie intact.
    if (stayLoggedIn) {
      return NextResponse.json({ ok: true, redirect: '/household' })
    }

    // Dernier foyer : déconnexion propre. Clear cookie sur une réponse 200 JSON
    // (fiable en WKWebView) ; le client suit `redirect` vers la landing.
    const response = NextResponse.json({ ok: true, redirect: '/' })
    clearSessionCookie(response)
    return response
  },
)
