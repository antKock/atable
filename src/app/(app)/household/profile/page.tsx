import { notFound, redirect } from 'next/navigation'
import { getOwnerContext } from '@/lib/auth/owner-context'
import { isDemoOwner } from '@/lib/api/with-owner-auth'
import { aliasForOwner } from '@/lib/alias'
import { getLocale } from '@/lib/i18n/server'
import ProfileForm from '@/components/household/ProfileForm'
import LogoutDialog from '@/components/household/LogoutDialog'

export default async function ProfilePage() {
  const owner = await getOwnerContext()
  const locale = await getLocale()
  if (!owner) redirect('/')

  // Stratégie C : pas de profil démo — l'écran n'existe pas pour ces sessions.
  if (isDemoOwner(owner)) notFound()

  return (
    <>
      <ProfileForm
        initialName={owner.ownerName ?? ''}
        alias={owner.ownerAlias ?? aliasForOwner(owner.ownerId, locale)}
        initialEmail={owner.recoveryEmail ?? ''}
      />
      <LogoutDialog hasRecoveryEmail={owner.recoveryEmail !== null} />
    </>
  )
}
