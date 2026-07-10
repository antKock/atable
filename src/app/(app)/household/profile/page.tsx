import { notFound, redirect } from 'next/navigation'
import { getOwnerContext } from '@/lib/auth/owner-context'
import { aliasForOwner } from '@/lib/alias'
import ProfileForm from '@/components/household/ProfileForm'

export default async function ProfilePage() {
  const owner = await getOwnerContext()
  if (!owner) redirect('/')

  // Stratégie C : pas de profil démo — l'écran n'existe pas pour ces sessions.
  if (owner.memberships.some((m) => m.isDemo)) notFound()

  return (
    <ProfileForm
      initialName={owner.ownerName ?? ''}
      alias={aliasForOwner(owner.ownerId)}
    />
  )
}
