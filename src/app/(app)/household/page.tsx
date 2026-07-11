import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getOwnerContext, type MembershipRole } from '@/lib/auth/owner-context'
import { isDemoOwner } from '@/lib/api/with-owner-auth'
import { aliasForOwner } from '@/lib/alias'
import HouseholdMenuContent from '@/components/household/HouseholdMenuContent'

// Ligne PostgREST : households + compteurs embarqués (une seule requête
// groupée pour N foyers — pas de N+1). personnes = memberships du foyer.
type HouseholdRow = {
  id: string
  name: string
  memberships: { count: number }[]
  recipes: { count: number }[]
}

export default async function HouseholdPage() {
  const owner = await getOwnerContext()
  if (!owner || owner.memberships.length === 0) redirect('/')

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('households')
    .select('id, name, memberships(count), recipes(count)')
    .in('id', owner.memberships.map((m) => m.householdId))

  // Une panne DB transitoire ne doit JAMAIS se lire « tu n'as aucun foyer » :
  // le hub proposerait « Créer ou rejoindre », qui change le foyer de
  // l'appareil. On propage vers l'error boundary (doctrine du Lot 0).
  if (error) {
    throw new Error(`household hub: chargement des foyers impossible (${error.message})`)
  }

  const rows = (data ?? []) as unknown as HouseholdRow[]
  const byId = new Map(rows.map((row) => [row.id, row]))

  // L'ordre des memberships (contexte owner) fait foi, pas celui de la requête.
  const households = owner.memberships.flatMap((membership) => {
    const row = byId.get(membership.householdId)
    if (!row) return []
    return [{
      id: row.id,
      name: row.name,
      role: membership.role as MembershipRole,
      isDemo: membership.isDemo,
      // Le foyer démo accumule un owner par visiteur (purge cron à 30 j) :
      // afficher ce compte fuiterait les autres visiteurs et n'a aucun sens.
      // Monde gelé = vue solo (cf. la liste des membres du détail).
      people: membership.isDemo ? 1 : (row.memberships[0]?.count ?? 0),
      recipes: row.recipes[0]?.count ?? 0,
    }]
  })

  return (
    <HouseholdMenuContent
      ownerDisplayName={owner.ownerName ?? aliasForOwner(owner.ownerId)}
      households={households}
      isDemo={isDemoOwner(owner)}
      hasRecoveryEmail={owner.recoveryEmail !== null}
    />
  )
}
