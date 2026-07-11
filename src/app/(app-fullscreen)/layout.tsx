import { redirect } from 'next/navigation'
import { Toaster } from '@/components/ui/sonner'
import DeviceTokenProvider from '@/components/layout/DeviceTokenProvider'
import { getOwnerContext } from '@/lib/auth/owner-context'

export default async function FullscreenShell({ children }: { children: React.ReactNode }) {
  // Même garde que (app)/layout : le JWT a passé le middleware, mais la
  // session doit se résoudre en owner en DB — sinon déconnexion propre.
  // (Erreur DB → propage vers l'error boundary, pas de purge de cookie.)
  const owner = await getOwnerContext()
  // Session inconnue OU owner sans appartenance (retrait de membre, Lot 3) :
  // déconnexion propre — sinon un owner orphelin lirait encore une fiche par
  // URL directe via le hid vestigial du JWT. Cf. (app)/layout.tsx.
  if (!owner || owner.memberships.length === 0) redirect('/api/auth/session/clear')

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
