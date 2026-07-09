import { redirect } from 'next/navigation'
import { Toaster } from '@/components/ui/sonner'
import DeviceTokenProvider from '@/components/layout/DeviceTokenProvider'
import { getOwnerContext } from '@/lib/auth/owner-context'

export default async function FullscreenShell({ children }: { children: React.ReactNode }) {
  // Même garde que (app)/layout : le JWT a passé le middleware, mais la
  // session doit se résoudre en owner en DB — sinon déconnexion propre.
  const owner = await getOwnerContext()
  if (!owner) redirect('/api/auth/session/clear')

  return (
    <>
      <DeviceTokenProvider />
      <main className="min-h-screen" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {children}
      </main>
      <Toaster />
    </>
  )
}
