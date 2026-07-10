import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Navigation from '@/components/layout/Navigation'
import DeviceTokenProvider from '@/components/layout/DeviceTokenProvider'
import { Toaster } from '@/components/ui/sonner'
import DemoBanner from '@/components/demo/DemoBanner'
import InstallAppBanner from '@/components/app/InstallAppBanner'
import HintCard from '@/components/app/HintCard'
import { createServerClient } from '@/lib/supabase/server'
import { getOwnerContext } from '@/lib/auth/owner-context'
import { isDemoOwner } from '@/lib/api/with-owner-auth'
import { t } from '@/lib/i18n/fr'

// Seuil du hint principal (#14, décision n°9) : partage tant que le foyer a
// moins de 3 recettes, puis email tant que recovery_email est absent.
const SHARE_HINT_RECIPE_THRESHOLD = 3

export default async function AppShell({ children }: { children: React.ReactNode }) {
  // Le JWT a passé le middleware (signature) mais la session doit exister en
  // DB (owner résolu) : un sid inconnu/révoqué = déconnecté, cookie purgé.
  // Une erreur DB, elle, PROPAGE (error boundary) — jamais de purge de cookie
  // sur incident transitoire. getOwnerContext est mémoïsé par requête —
  // layout + page = une seule requête.
  const owner = await getOwnerContext()
  if (!owner) redirect('/api/auth/session/clear')

  const isDemo = isDemoOwner(owner)

  // Hints server-gated (#14, maquette 1.1) : la bannière démo prime sur tout ;
  // sinon install (mini-strip, iOS web) AU-DESSUS d'UN hint principal
  // (partage OU email). Tous à dismiss définitif par cookie (180 j). En démo :
  // aucun hint — la bannière démo est le seul chemin (conversion).
  const hdrs = await headers()
  const cookieStore = await cookies()
  let installCode: string | null = null
  let mainHint: 'share' | 'email' | null = null
  let shareHref = '/household'

  if (!isDemo) {
    // iOS web visitors (not the native shell) get a one-time, dismissible
    // nudge to install the app. The foyer code travels with it so they can
    // re-join inside the app's WebView (separate cookie jar from Safari).
    const ua = hdrs.get('user-agent') ?? ''
    const isIOSWeb = /iPhone|iPad|iPod/i.test(ua) && !ua.includes('MijoteNative')
    const installDismissed = cookieStore.get('mijote_install_dismissed')?.value === '1'
    const householdId = hdrs.get('x-household-id')
    if (isIOSWeb && !installDismissed && householdId) {
      const { data } = await createServerClient()
        .from('households')
        .select('join_code')
        .eq('id', householdId)
        .single()
      installCode = (data?.join_code as string | undefined) ?? null
    }

    const shareDismissed = cookieStore.get('mijote_share_hint_dismissed')?.value === '1'
    const emailDismissed = cookieStore.get('mijote_email_hint_dismissed')?.value === '1'
    const emailEligible = !emailDismissed && owner.recoveryEmail === null
    if ((!shareDismissed || emailEligible) && owner.memberships.length > 0) {
      // Compteur groupé sur tous les foyers de l'owner — requête payée
      // seulement quand un hint est encore possible. Échec silencieux : un
      // hint absent ne vaut pas une app cassée (même politique qu'install).
      const { count, error } = await createServerClient()
        .from('recipes')
        .select('id', { count: 'exact', head: true })
        .in('household_id', owner.memberships.map((m) => m.householdId))
      if (!error) {
        if ((count ?? 0) < SHARE_HINT_RECIPE_THRESHOLD) {
          mainHint = shareDismissed ? null : 'share'
        } else {
          mainHint = emailEligible ? 'email' : null
        }
      }
      shareHref = `/household/${owner.memberships[0].householdId}`
    }
  }

  const hasHints = isDemo || installCode !== null || mainHint !== null

  return (
    <>
      <DeviceTokenProvider />
      <div className="mx-auto max-w-[1100px]">
        <main
          className="min-h-screen pb-28"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {hasHints && (
            <div className="flex flex-col gap-2.5 px-4 pt-3">
              {isDemo && <DemoBanner />}
              {installCode && <InstallAppBanner code={installCode} />}
              {mainHint === 'share' && (
                <HintCard
                  variant="share"
                  title={t.hints.share.title}
                  body={t.hints.share.body}
                  cta={t.hints.share.cta}
                  href={shareHref}
                />
              )}
              {mainHint === 'email' && (
                <HintCard
                  variant="email"
                  title={t.hints.email.title}
                  body={t.hints.email.body}
                  cta={t.hints.email.cta}
                  href="/household/profile"
                  dismissToast={t.hints.email.dismissToast}
                />
              )}
            </div>
          )}
          {children}
        </main>
      </div>
      <Navigation />
      <Toaster />
    </>
  )
}
