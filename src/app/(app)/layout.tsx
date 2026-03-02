import { headers } from 'next/headers'
import Navigation from '@/components/layout/Navigation'
import DeviceTokenProvider from '@/components/layout/DeviceTokenProvider'
import { Toaster } from '@/components/ui/sonner'
import DemoBanner from '@/components/demo/DemoBanner'

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const hdrs = await headers()
  const householdId = hdrs.get('x-household-id')
  const isDemo = householdId === process.env.DEMO_HOUSEHOLD_ID && !!householdId

  return (
    <>
      <DeviceTokenProvider />
      {isDemo && <DemoBanner />}
      <div className="lg:pl-56">
        <main className="min-h-screen pb-20 lg:pb-0">{children}</main>
      </div>
      <Navigation />
      <Toaster />
    </>
  )
}
