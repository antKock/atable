import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Navigation from '@/components/layout/Navigation'
import DeviceTokenProvider from '@/components/layout/DeviceTokenProvider'
import { Toaster } from '@/components/ui/sonner'
import DemoBanner from '@/components/demo/DemoBanner'
import InstallAppBanner from '@/components/app/InstallAppBanner'
import { createServerClient } from '@/lib/supabase/server'
import { getOwnerContext } from '@/lib/auth/owner-context'

export default async function AppShell({ children }: { children: React.ReactNode }) {
  // Le JWT a passé le middleware (signature) mais la session doit exister en
  // DB (owner résolu) : un sid inconnu/révoqué = déconnecté, cookie purgé.
  // getOwnerContext est mémoïsé par requête — layout + page = une seule requête.
  const owner = await getOwnerContext()
  if (!owner) redirect('/api/auth/session/clear')

  const hdrs = await headers()
  const householdId = hdrs.get('x-household-id')
  const isDemo = householdId === process.env.DEMO_HOUSEHOLD_ID && !!householdId

  // iOS web visitors (not the native shell) get a one-time, dismissible nudge to
  // install the app. The foyer code travels with it so they can re-join inside
  // the app's WebView, which doesn't share Safari's cookie jar. Gated server-side
  // so the lookup runs only for the eligible, not-yet-dismissed audience.
  const ua = hdrs.get('user-agent') ?? ''
  const isIOSWeb = /iPhone|iPad|iPod/i.test(ua) && !ua.includes('MijoteNative')
  const dismissed = (await cookies()).get('mijote_install_dismissed')?.value === '1'
  let installCode: string | null = null
  if (isIOSWeb && !dismissed && !isDemo && householdId) {
    const { data } = await createServerClient()
      .from('households')
      .select('join_code')
      .eq('id', householdId)
      .single()
    installCode = (data?.join_code as string | undefined) ?? null
  }

  return (
    <>
      <DeviceTokenProvider />
      {isDemo && <DemoBanner />}
      <div className="mx-auto max-w-[1100px]">
        {/* When the demo banner is shown it already clears the notch; otherwise
            the page content needs the top safe-area padding itself. */}
        <main
          className="min-h-screen pb-28"
          style={isDemo ? undefined : { paddingTop: 'env(safe-area-inset-top)' }}
        >
          {installCode && <InstallAppBanner code={installCode} />}
          {children}
        </main>
      </div>
      <Navigation />
      <Toaster />
    </>
  )
}
