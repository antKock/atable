'use client'

import { useState } from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import { t } from '@/lib/i18n/fr'
import { dropSwrCache } from '@/lib/swr'

// Bannière démo persistante. Gabarit « hint classique » (même grammaire
// visuelle que HintCard partage/email) pour être plus visible et explicite :
// l'utilisateur doit comprendre que c'est un compte de test dont les recettes
// ne sont pas conservées. NON dismissable — c'est l'état démo ET le seul chemin
// de conversion (sortie → création de foyer).
//
// On reprend la grammaire visuelle de HintCard (classes), pas le composant :
// HintCard est couplé aux hints dismissables à lien (variant→cookie, <Link>),
// alors qu'ici il faut un bouton d'action (fetch de sortie) et pas de croix.
//
// Reste STICKY : la sortie doit rester atteignable au scroll, et la bannière
// absorbe le notch — d'où l'absence de padding safe-area sur le <main> en démo
// (cf. (app)/layout.tsx).
export default function DemoBanner() {
  const [loading, setLoading] = useState(false)

  async function handleExit() {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/session', {
        method: 'DELETE',
        redirect: 'follow',
      })
      if (response.redirected) {
        dropSwrCache() // demo data must not leak into the next session
        window.location.href = response.url
        return
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <div
      className="sticky top-0 z-40 bg-background/90 px-4 pb-2 backdrop-blur-sm"
      style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
    >
      <div className="rounded-[14px] bg-accent/10 py-3.5 pl-3.5 pr-3.5">
        <div className="flex gap-3">
          <span className="mt-0.5 shrink-0 text-accent" aria-hidden="true">
            <Sparkles size={20} />
          </span>
          <div>
            <p className="text-[13.5px] font-semibold text-foreground">{t.demo.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.demo.body}</p>
            <button
              type="button"
              onClick={handleExit}
              disabled={loading}
              className="mt-2 inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-accent transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {loading ? '…' : t.demo.cta}
              {!loading && <ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
