import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getOwnerContext, type MembershipRole } from '@/lib/auth/owner-context'
import { aliasForOwner } from '@/lib/alias'
import HouseholdDetailContent from '@/components/household/HouseholdDetailContent'

type Props = { params: Promise<{ id: string }> }

// Ligne PostgREST : memberships du foyer + nom de l'owner (FK → objet).
type MemberRow = {
  owner_id: string
  role: string
  owners: { name: string | null } | null
}

type Member = {
  ownerId: string
  displayName: string
  role: MembershipRole
  isViewer: boolean
}

export default async function HouseholdDetailPage({ params }: Props) {
  const { id } = await params
  const owner = await getOwnerContext()
  if (!owner) redirect('/')

  // Accès refusé si le foyer n'est pas dans les memberships du viewer.
  const membership = owner.memberships.find((m) => m.householdId === id)
  if (!membership) notFound()

  const supabase = createServerClient()
  const { data: household, error: householdError } = await supabase
    .from('households')
    .select('id, name, join_code, is_demo')
    .eq('id', id)
    .single()

  // PGRST116 = zéro ligne (foyer supprimé entre-temps) → 404 légitime. Toute
  // autre erreur est une panne : la propager plutôt que d'afficher « cette
  // page n'existe pas » pour un foyer dont le membership vient d'être validé.
  if (householdError && householdError.code !== 'PGRST116') {
    throw new Error(`household detail: chargement du foyer impossible (${householdError.message})`)
  }
  if (!household) notFound()

  const viewerName = owner.ownerName ?? aliasForOwner(owner.ownerId)
  let members: Member[]

  if (membership.isDemo) {
    // Monde gelé : chaque visiteur de la démo a son propre owner+membership
    // (purge cron à 30 j). Lister le foyer démo exposerait les autres
    // visiteurs et rendrait des centaines de lignes — vue solo.
    members = [{ ownerId: owner.ownerId, displayName: viewerName, role: membership.role, isViewer: true }]
  } else {
    const { data: memberData, error: membersError } = await supabase
      .from('memberships')
      .select('owner_id, role, owners(name)')
      .eq('household_id', id)
      .order('created_at', { ascending: true })

    // Une erreur ici rendrait « Membre · 0 personnes » : un état plausible mais
    // faux. On propage vers l'error boundary.
    if (membersError) {
      throw new Error(`household detail: chargement des membres impossible (${membersError.message})`)
    }

    members = ((memberData ?? []) as unknown as MemberRow[]).map((row) => ({
      ownerId: row.owner_id,
      // Les owners du backfill Lot 0 n'ont pas de nom → alias auto (voulu).
      displayName: row.owners?.name ?? aliasForOwner(row.owner_id),
      role: (row.role === 'guest' ? 'guest' : 'member') as MembershipRole,
      isViewer: row.owner_id === owner.ownerId,
    }))
  }

  return (
    <HouseholdDetailContent
      household={{
        id: household.id,
        name: household.name,
        joinCode: household.join_code,
        isDemo: household.is_demo,
      }}
      viewerRole={membership.role}
      members={members}
    />
  )
}
