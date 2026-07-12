import { headers, cookies } from 'next/headers'
import InstallAppBanner from '@/components/app/InstallAppBanner'
import HintCard from '@/components/app/HintCard'
import { createServerClient } from '@/lib/supabase/server'
import { getOwnerContext, isGuestOwner } from '@/lib/auth/owner-context'
import { isDemoOwner } from '@/lib/api/with-owner-auth'
import { t } from '@/lib/i18n/fr'

// Seuil du hint principal (#14, décision n°9) : partage tant que le foyer a
// moins de 3 recettes, puis email tant que recovery_email est absent.
const SHARE_HINT_RECIPE_THRESHOLD = 3

// Hints server-gated (#14, maquette 1.1) rendus SOUS la top bar de la Home, et
// UNIQUEMENT ici (décision n°9 : « hints = vue principale /home »). Avant, ils
// vivaient dans (app)/layout.tsx : un layout partagé ne se ré-évalue pas à la
// navigation client → le hint restait affiché après un clic vers le profil, et
// se peignait au-dessus de la top bar. Les rendre dans la page /home règle les
// deux : ils disparaissent dès qu'on quitte la Home et se placent après l'entête.
//
// install (mini-strip, iOS web) AU-DESSUS d'UN hint principal (partage OU
// email). Tous à dismiss définitif par cookie (180 j). En démo : aucun hint —
// la bannière démo est le seul chemin (conversion).
export default async function HomeHints() {
  // getOwnerContext est mémoïsé par requête (déjà résolu par le layout + la
  // page) : pas de requête DB supplémentaire.
  const owner = await getOwnerContext()
  if (!owner || owner.memberships.length === 0) return null

  const isDemo = isDemoOwner(owner)
  if (isDemo) return null

  const isGuest = isGuestOwner(owner)
  const hdrs = await headers()
  const cookieStore = await cookies()

  let installCode: string | null = null
  let mainHint: 'share' | 'email' | null = null

  // CTA du hint partage : le détail d'un foyer où l'owner est MEMBRE (là où
  // vivent code et lien d'invitation). Multi-foyer (Lot 4) : premier membre.
  const shareFoyerId = owner.memberships.find((m) => m.role === 'member')?.householdId
  const shareHref = shareFoyerId ? `/household/${shareFoyerId}` : '/household'

  // iOS web visitors (not the native shell) get a one-time, dismissible nudge to
  // install the app. The foyer code travels with it so they can re-join inside
  // the app's WebView (separate cookie jar from Safari).
  const ua = hdrs.get('user-agent') ?? ''
  const isIOSWeb = /iPhone|iPad|iPod/i.test(ua) && !ua.includes('MijoteNative')
  const installDismissed = cookieStore.get('mijote_install_dismissed')?.value === '1'
  const installHouseholdId = owner.memberships.find((m) => m.role === 'member')?.householdId
  if (isIOSWeb && !installDismissed && installHouseholdId) {
    const { data } = await createServerClient()
      .from('households')
      .select('join_code')
      .eq('id', installHouseholdId)
      .single()
    installCode = (data?.join_code as string | undefined) ?? null
  }

  const shareDismissed = cookieStore.get('mijote_share_hint_dismissed')?.value === '1'
  const emailDismissed = cookieStore.get('mijote_email_hint_dismissed')?.value === '1'
  const emailEligible = !emailDismissed && owner.recoveryEmail === null
  if (!shareDismissed || emailEligible) {
    // Compteur groupé sur tous les foyers de l'owner — requête payée seulement
    // quand un hint est encore possible. Échec silencieux : un hint absent ne
    // vaut pas une app cassée (même politique qu'install).
    const { count, error } = await createServerClient()
      .from('recipes')
      .select('id', { count: 'exact', head: true })
      .in('household_id', owner.memberships.map((m) => m.householdId))
    if (!error) {
      if ((count ?? 0) < SHARE_HINT_RECIPE_THRESHOLD) {
        // Le hint partage invite à « Inviter quelqu'un » : sans objet pour un
        // invité (lecture seule, ne peut pas inviter) — on ne l'affiche pas.
        mainHint = shareDismissed || isGuest ? null : 'share'
      } else {
        mainHint = emailEligible ? 'email' : null
      }
    }
  }

  if (!installCode && !mainHint) return null

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-4">
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
  )
}
