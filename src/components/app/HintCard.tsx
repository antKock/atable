'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ShieldCheck, Users, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { t } from '@/lib/i18n/fr'
import CreateHouseholdForm from '@/components/auth/CreateHouseholdForm'

const DISMISS_MAX_AGE = 60 * 60 * 24 * 180 // 180 jours, comme install

type Props = {
  // Variante = icône + (pour share/email) cookie de dismiss + CTA lien. La
  // variante `demo` est un cas à part : non dismissable, et son CTA n'est pas
  // un lien mais l'ouverture directe du formulaire de création (conversion).
  variant: 'share' | 'email' | 'demo'
  title: string
  body: string
  cta: string
  // Requis pour share/email (destination du CTA). Ignoré pour `demo`.
  href?: string
  dismissToast?: string
}

const ICONS = {
  share: Users,
  email: ShieldCheck,
  demo: Sparkles,
} as const

const COOKIES = {
  share: 'mijote_share_hint_dismissed',
  email: 'mijote_email_hint_dismissed',
} as const

// Hint principal de la home (#14, maquette 1.1) : généralisation de la
// grammaire InstallAppBanner — icône + titre + corps + CTA + croix. Dismiss
// définitif (cookie 180 j, server-gated au layout comme install).
//
// La variante `demo` réutilise la même carte mais : (1) pas de croix — c'est
// l'état démo, pas un nudge ; (2) le CTA ouvre le formulaire « nom du foyer »
// plein écran (conversion démo → owner neuf via POST /api/households) au lieu
// de renvoyer sur l'accueil.
export default function HintCard({ variant, title, body, cta, href, dismissToast }: Props) {
  const [hidden, setHidden] = useState(false)
  const [creating, setCreating] = useState(false)
  const Icon = ICONS[variant]
  const isDemo = variant === 'demo'

  function dismiss() {
    if (isDemo) return
    document.cookie = `${COOKIES[variant]}=1; max-age=${DISMISS_MAX_AGE}; path=/`
    setHidden(true)
    if (dismissToast) toast(dismissToast, { duration: 3000 })
  }

  if (hidden) return null

  const ctaClasses =
    'mt-2 inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-accent transition-opacity hover:opacity-80'

  return (
    <div className={`relative rounded-[14px] bg-accent/10 py-3.5 pl-3.5 ${isDemo ? 'pr-3.5' : 'pr-10'}`}>
      {!isDemo && (
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.hints.dismiss}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/20"
        >
          <X size={14} />
        </button>
      )}
      <div className="flex gap-3">
        <span className="mt-0.5 shrink-0 text-accent" aria-hidden="true">
          <Icon size={20} />
        </span>
        <div>
          <p className="text-[13.5px] font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
          {isDemo ? (
            <button type="button" onClick={() => setCreating(true)} className={ctaClasses}>
              {cta}
              <ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : (
            <Link href={href!} className={ctaClasses}>
              {cta}
              <ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      {/* Conversion : le formulaire plein écran passe AU-DESSUS de la nav
          flottante (z-50). CreateHouseholdForm est déjà `fixed inset-0` ; on
          l'enveloppe pour établir le contexte d'empilement. */}
      {isDemo && creating && (
        <div className="fixed inset-0 z-[60]">
          <CreateHouseholdForm onCancel={() => setCreating(false)} />
        </div>
      )}
    </div>
  )
}
