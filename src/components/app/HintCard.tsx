'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ShieldCheck, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { t } from '@/lib/i18n/fr'

const DISMISS_MAX_AGE = 60 * 60 * 24 * 180 // 180 jours, comme install

type Props = {
  // Variante = icône + cookie de dismiss (le contenu vient des props : le
  // layout serveur choisit LE hint principal — un seul à la fois).
  variant: 'share' | 'email'
  title: string
  body: string
  cta: string
  href: string
  dismissToast?: string
}

const ICONS = {
  share: Users,
  email: ShieldCheck,
} as const

const COOKIES = {
  share: 'mijote_share_hint_dismissed',
  email: 'mijote_email_hint_dismissed',
} as const

// Hint principal de la home (#14, maquette 1.1) : généralisation de la
// grammaire InstallAppBanner — icône + titre + corps + CTA + croix. Dismiss
// définitif (cookie 180 j, server-gated au layout comme install).
export default function HintCard({ variant, title, body, cta, href, dismissToast }: Props) {
  const [hidden, setHidden] = useState(false)
  const Icon = ICONS[variant]

  function dismiss() {
    document.cookie = `${COOKIES[variant]}=1; max-age=${DISMISS_MAX_AGE}; path=/`
    setHidden(true)
    if (dismissToast) toast(dismissToast, { duration: 3000 })
  }

  if (hidden) return null

  return (
    <div className="relative rounded-[14px] bg-accent/10 py-3.5 pl-3.5 pr-10">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.hints.dismiss}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/20"
      >
        <X size={14} />
      </button>
      <div className="flex gap-3">
        <span className="mt-0.5 shrink-0 text-accent" aria-hidden="true">
          <Icon size={20} />
        </span>
        <div>
          <p className="text-[13.5px] font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
          <Link
            href={href}
            className="mt-2 inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-accent transition-opacity hover:opacity-80"
          >
            {cta}
            <ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  )
}
