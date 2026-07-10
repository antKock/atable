'use client'

import { KeyRound, Mail } from 'lucide-react'
import { t } from '@/lib/i18n/fr'

type Props = {
  onCode: () => void
  onRecover: () => void
  onBack: () => void
}

// Fork « Rejoindre un foyer » (#14, maquette 1.2) — clé anti-doublon : sur un
// device neuf, rejoindre un proche OU retrouver son propre foyer passe par
// ici, au lieu de recréer un owner. Copy volontairement générique.
export default function JoinForkScreen({ onCode, onRecover, onBack }: Props) {
  return (
    <div className="bg-sage-radial fixed inset-0 flex flex-col text-background">
      <button
        type="button"
        onClick={onBack}
        aria-label={t.a11y.backButton}
        className="fixed left-2 z-10 flex h-10 w-10 items-center justify-center text-background"
        style={{ top: 'calc(env(safe-area-inset-top) + 13px)' }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
          style={{ boxShadow: 'inset 0 0 0 1.5px rgba(245, 241, 232, 0.5)' }}
        >
          <KeyRound size={30} aria-hidden="true" />
        </div>
        <h1
          className="mt-6"
          style={{
            fontFamily: 'var(--font-fraunces), "Times New Roman", serif',
            fontVariationSettings: '"opsz" 144',
            fontWeight: 700,
            fontSize: 36,
            letterSpacing: '-0.02em',
            lineHeight: 1.02,
          }}
        >
          {t.landing.joinHousehold}
        </h1>
        <p className="mt-3 max-w-[272px] text-[14.5px] leading-relaxed text-background/85">
          {t.recovery.forkBody}
        </p>
      </div>

      <div
        className="mx-auto flex w-full max-w-[400px] flex-col gap-2.5 px-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}
      >
        <button
          type="button"
          onClick={onCode}
          className="flex h-[54px] items-center justify-center gap-2 rounded-[27px] bg-background text-[17px] font-semibold tracking-[-0.005em] text-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70"
        >
          <KeyRound size={18} aria-hidden="true" />
          {t.recovery.forkCode}
        </button>
        <button
          type="button"
          onClick={onRecover}
          className="flex h-[54px] items-center justify-center gap-2 rounded-[27px] bg-transparent text-[16px] font-medium text-background transition-colors hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70"
          style={{ boxShadow: 'inset 0 0 0 1.5px rgba(245, 241, 232, 0.55)' }}
        >
          <Mail size={18} aria-hidden="true" />
          {t.recovery.forkEmail}
        </button>
      </div>
    </div>
  )
}
