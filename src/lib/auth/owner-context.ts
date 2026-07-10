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
    .select('owner_id, is_revoked, owners(name, memberships(household_id, role, households(is_demo)))')
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

  return { ownerId: row.owner_id, ownerName: row.owners.name, sessionId, memberships }
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
