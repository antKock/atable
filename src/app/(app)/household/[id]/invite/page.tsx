import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getOwnerContext } from '@/lib/auth/owner-context'
import InviteScreen from '@/components/household/InviteScreen'

type Props = { params: Promise<{ id: string }> }

// Écran plein « Inviter » (maquette 2.1, Lot 3) : deux liens stables par rôle.
// Réservé aux MEMBRES d'un foyer non-démo — un invité ne peut pas inviter
// (l'UI cache l'entrée, cette page garde l'accès direct par URL).
export default async function InvitePage({ params }: Props) {
  const { id } = await params
  const owner = await getOwnerContext()
  if (!owner) redirect('/')

  const membership = owner.memberships.find((m) => m.householdId === id)
  // Ni membre, ni foyer connu, ou démo (monde gelé) → 404 : l'invitation n'a
  // pas de sens et le join exclut de toute façon la démo.
  if (!membership || membership.role !== 'member' || membership.isDemo) {
    notFound()
  }

  const supabase = createServerClient()
  const { data: household, error } = await supabase
    .from('households')
    .select('id, name, join_code, guest_join_code')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`invite: chargement du foyer impossible (${error.message})`)
  }
  if (!household) notFound()

  return (
    <InviteScreen
      householdId={household.id}
      joinCode={household.join_code}
      guestJoinCode={household.guest_join_code}
    />
  )
}
