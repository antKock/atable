import { notFound, redirect } from 'next/navigation'
import { getOwnerContext } from '@/lib/auth/owner-context'
import { isDemoOwner } from '@/lib/api/with-owner-auth'
import SwitchHouseholdScreen from '@/components/household/SwitchHouseholdScreen'

export default async function SwitchHouseholdPage() {
  const owner = await getOwnerContext()
  if (!owner) redirect('/')

  // Stratégie C : le hub démo n'expose pas cette entrée — l'URL directe ne doit
  // pas la rouvrir. La sortie de la démo passe par la bannière de conversion.
  if (isDemoOwner(owner)) notFound()

  return <SwitchHouseholdScreen />
}
