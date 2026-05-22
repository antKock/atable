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
      <div className="lg:pl-56">
        {isDemo && <DemoBanner />}
        {/* When the demo banner is shown it already clears the notch; otherwise
            the page content needs the top safe-area padding itself. */}
        <main
          className="min-h-screen pb-24 lg:pb-0"
          style={isDemo ? undefined : { paddingTop: 'env(safe-area-inset-top)' }}
        >
          {children}
        </main>
      </div>
      <Navigation />
      <Toaster />
    </>
  )
}
