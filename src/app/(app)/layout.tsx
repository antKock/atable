import { redirect } from 'next/navigation'
import Navigation from '@/components/layout/Navigation'
import DeviceTokenProvider from '@/components/layout/DeviceTokenProvider'
import { Toaster } from '@/components/ui/sonner'
import DemoBanner from '@/components/demo/DemoBanner'
import { getOwnerContext, isGuestOwner } from '@/lib/auth/owner-context'
import { isDemoOwner } from '@/lib/api/with-owner-auth'

export default async function AppShell({ children }: { children: React.ReactNode }) {
  // Le JWT a passé le middleware (signature) mais la session doit exister en
  // DB (owner résolu) : un sid inconnu/révoqué = déconnecté, cookie purgé.
  // Une erreur DB, elle, PROPAGE (error boundary) — jamais de purge de cookie
  // sur incident transitoire. getOwnerContext est mémoïsé par requête —
  // layout + page = une seule requête.
  const owner = await getOwnerContext()
  // Session inconnue OU owner sans aucune appartenance : dans les deux cas
  // l'appareil n'a plus accès à un foyer. Le second cas = retrait de membre
  // (Lot 3) : le hid du JWT est vestigial, donc sans cette garde un owner
  // orphelin verrait encore les recettes via x-household-id. Déconnexion propre
  // → l'accès est coupé dès la page suivante (mono-appartenance).
  if (!owner || owner.memberships.length === 0) redirect('/api/auth/session/clear')

  const isDemo = isDemoOwner(owner)
  const isGuest = isGuestOwner(owner)

  // Les hints (install + partage/email) sont rendus DANS la page /home
  // (`HomeHints`), sous la top bar — pas ici. Un layout partagé ne se
  // ré-évalue pas à la navigation client, ce qui laissait les hints collés
  // après un clic vers un autre écran, et au-dessus de la top bar.

  return (
    <>
      <DeviceTokenProvider />
      {/* Hors du <main> et du conteneur centré : sticky pleine largeur, et
          c'est elle qui dégage le notch quand elle est là. */}
      {isDemo && <DemoBanner />}
      <div className="mx-auto max-w-[1100px]">
        <main
          className="min-h-screen"
          style={{
            // Bas : dégage la nav flottante ET la barre système Android (safe
            // area). Sans l'inset, le dernier contenu passe sous la barre
            // d'action Android en edge-to-edge (targetSdk 36).
            paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))',
            ...(isDemo ? {} : { paddingTop: 'env(safe-area-inset-top)' }),
          }}
        >
          {children}
        </main>
      </div>
      <Navigation isGuest={isGuest} />
      <Toaster />
    </>
  )
}
