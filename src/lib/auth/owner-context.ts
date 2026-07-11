import { cache } from 'react'
import { headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'

// Résolution d'identité du chantier foyer (#14 + #15) : le sid du JWT est la
// seule clé — la DB porte l'owner et ses appartenances. Le hid du JWT est
// vestigial (gardé pour rollback, décommissionné en fin de chantier).

export type MembershipRole = 'member' | 'guest'

export type OwnerMembership = {
  householdId: string
  role: MembershipRole
  isDemo: boolean
}

export type OwnerContext = {
  ownerId: string
  /** NULL → alias auto dérivé de l'id (src/lib/alias.ts), jamais stocké. */
  ownerName: string | null
  /** Email de secours (#14), déjà normalisé lowercase. NULL → pas posé. */
  recoveryEmail: string | null
  sessionId: string
  memberships: OwnerMembership[]
}

// Ligne PostgREST : device_sessions → owners (FK) → memberships (inverse)
// → households (FK), en une seule requête service role.
type SessionRow = {
  owner_id: string | null
  is_revoked: boolean
  owners: {
    name: string | null
    recovery_email: string | null
    memberships: {
      household_id: string
      role: string
      households: { is_demo: boolean } | null
    }[]
  } | null
}

/**
 * Résout une session vers son owner et ses appartenances. `null` si la session
 * est inconnue ou révoquée — l'appelant traite ce cas comme « déconnecté ».
 * (Une session sans owner_id ne peut naître que dans la fenêtre entre le
 * `db push` de la 027 et le déploiement du code : même traitement.)
 *
 * Une erreur de requête (Supabase indisponible…) est PROPAGÉE, jamais
 * confondue avec une session inconnue : les guards API répondent 500 et les
 * layouts affichent l'error boundary. Renvoyer null ici ferait purger le
 * cookie de chaque visiteur à chaque incident DB — une panne transitoire ne
 * doit pas détruire des sessions.
 */
export async function resolveOwnerContext(sessionId: string): Promise<OwnerContext | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('device_sessions')
    .select('owner_id, is_revoked, owners(name, recovery_email, memberships(household_id, role, households(is_demo)))')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) {
    throw new Error(`owner-context: résolution de session impossible (${error.message})`)
  }
  if (!data) return null
  const row = data as unknown as SessionRow
  if (row.is_revoked || !row.owner_id || !row.owners) return null

  const memberships: OwnerMembership[] = (row.owners.memberships ?? []).map((m) => ({
    householdId: m.household_id,
    role: m.role === 'guest' ? 'guest' : 'member',
    isDemo: m.households?.is_demo ?? false,
  }))

  return {
    ownerId: row.owner_id,
    ownerName: row.owners.name,
    recoveryEmail: row.owners.recovery_email ?? null,
    sessionId,
    memberships,
  }
}

/**
 * Contexte owner de la requête courante, depuis le header x-session-id injecté
 * par le middleware. Mémoïsé par requête via React cache() : layout + page ne
 * paient qu'une seule requête DB par rendu.
 */
export const getOwnerContext = cache(async (): Promise<OwnerContext | null> => {
  const sessionId = (await headers()).get('x-session-id')
  if (!sessionId) return null
  return resolveOwnerContext(sessionId)
})

/**
 * L'owner est-il en lecture seule PARTOUT (invité de tous ses foyers, aucun
 * rôle membre) ? Multi-appartenance (Lot 4) : un owner membre de A et invité de
 * C peut écrire (dans A) — il n'est donc PAS « invité ». Ce prédicat masque les
 * affordances d'écriture GLOBALES (FAB, CTA de création, /recipes/new) ; la
 * fiche d'une recette, elle, décide au cas par cas selon le rôle de l'owner sur
 * LE foyer de la recette (cf. roleForHousehold). En écho au `requireMember` des
 * routes API (enforcement lecture seule, Lot 3).
 */
export function isGuestOwner(owner: OwnerContext): boolean {
  return !owner.memberships.some((m) => m.role === 'member')
}

/** Ids des foyers où l'owner est MEMBRE (destinations d'écriture / de choix). */
export function memberHouseholdIds(owner: OwnerContext): string[] {
  return owner.memberships.filter((m) => m.role === 'member').map((m) => m.householdId)
}

/** Ids de TOUS les foyers de l'owner (union de lecture : biblio, carrousels). */
export function householdIds(owner: OwnerContext): string[] {
  return owner.memberships.map((m) => m.householdId)
}

/** Rôle de l'owner sur un foyer donné, ou null s'il n'en est pas membre. */
export function roleForHousehold(owner: OwnerContext, householdId: string): MembershipRole | null {
  return owner.memberships.find((m) => m.householdId === householdId)?.role ?? null
}

// Force du rôle : membre > invité.
const ROLE_RANK: Record<MembershipRole, number> = { member: 2, guest: 1 }

export type RoleMergePlan = { action: 'add' | 'upgrade' | 'noop'; role: MembershipRole }

/**
 * Décide de l'effet d'un re-join ADDITIF (Lot 4) sur le rôle de l'owner dans le
 * foyer visé, à partir du rôle courant (null = pas encore membre) et du rôle
 * porté par le code d'invitation :
 *   - pas encore membre → `add` (nouveau membership) ;
 *   - déjà membre, code plus fort (invité→membre) → `upgrade` ;
 *   - déjà membre, code ≤ courant → `noop` (jamais de rétrogradation).
 */
export function planRoleMerge(
  current: MembershipRole | null,
  incoming: MembershipRole,
): RoleMergePlan {
  if (current === null) return { action: 'add', role: incoming }
  if (ROLE_RANK[incoming] > ROLE_RANK[current]) return { action: 'upgrade', role: incoming }
  return { action: 'noop', role: current }
}
