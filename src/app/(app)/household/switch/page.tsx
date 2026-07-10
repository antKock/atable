import { redirect } from 'next/navigation'
import { getOwnerContext } from '@/lib/auth/owner-context'
import SwitchHouseholdScreen from '@/components/household/SwitchHouseholdScreen'

export default async function SwitchHouseholdPage() {
  const owner = await getOwnerContext()
  if (!owner) redirect('/')
  return <SwitchHouseholdScreen />
}
