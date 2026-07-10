import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getOwnerContext } from '@/lib/auth/owner-context'
import { aliasForOwner } from '@/lib/alias'
import HouseholdDetailContent from '@/components/household/HouseholdDetailContent'

type Props = { params: Promise<{ id: string }> }

// Ligne PostgREST : memberships du foyer + nom de l'owner (FK → objet).
type MemberRow = {
  owner_id: string
  role: string
  owners: { name: string | null } | null
}

export default async function HouseholdDetailPage({ params }: Props) {
  const { id } = await params
  const owner = await getOwnerContext()
  if (!owner) redirect('/')

  // Accès refusé si le foyer n'est pas dans les memberships du viewer.
  const membership = owner.memberships.find((m) => m.householdId === id)
  if (!membership) notFound()

  const supabase = createServerClient()
  const [{ data: household }, { data: memberData }] = await Promise.all([
    supabase
      .from('households')
      .select('id, name, join_code, is_demo')
      .eq('id', id)
      .single(),
    supabase
      .from('memberships')
      .select('owner_id, role, owners(name)')
      .eq('household_id', id)
      .order('created_at', { ascending: true }),
  ])
  if (!household) notFound()

  const members = ((memberData ?? []) as unknown as MemberRow[]).map((row) => ({
    ownerId: row.owner_id,
    // Les owners du backfill Lot 0 n'ont pas de nom → alias auto (voulu).
    displayName: row.owners?.name ?? aliasForOwner(row.owner_id),
    role: (row.role === 'guest' ? 'guest' : 'member') as 'guest' | 'member',
    isViewer: row.owner_id === owner.ownerId,
  }))

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
