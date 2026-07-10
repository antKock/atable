import { notFound, redirect } from 'next/navigation'
import { getOwnerContext } from '@/lib/auth/owner-context'
import { isDemoOwner } from '@/lib/api/with-owner-auth'
import { aliasForOwner } from '@/lib/alias'
import ProfileForm from '@/components/household/ProfileForm'

export default async function ProfilePage() {
  const owner = await getOwnerContext()
  if (!owner) redirect('/')

  // Stratégie C : pas de profil démo — l'écran n'existe pas pour ces sessions.
  if (isDemoOwner(owner)) notFound()

  return (
    <ProfileForm
      initialName={owner.ownerName ?? ''}
      alias={aliasForOwner(owner.ownerId)}
    />
  )
}
