'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { t } from '@/lib/i18n/fr'

type Props = {
  icon: ReactNode
  label: string
  // Action à droite (bouton/lien stylé par l'appelant)
  action: ReactNode
  onDismiss?: () => void
}

// Hint mineur une-ligne (décision n°9) : gabarit partagé par la bannière
// install et la bannière démo. Purement présentationnel — le gating (cookies,
// audience) vit dans le layout serveur.
export default function MiniStrip({ icon, label, action, onDismiss }: Props) {
  return (
    <div
      className="flex h-10 items-center gap-2.5 rounded-[10px] bg-surface pl-3 pr-1"
      style={{ boxShadow: 'inset 0 0 0 1px var(--border)' }}
    >
      <span className="shrink-0 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">
        {label}
      </span>
      {action}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t.hints.dismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
        >
          <X size={13} />
        </button>
      ) : (
        <span className="w-1" aria-hidden="true" />
      )}
    </div>
  )
}
