'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { t } from '@/lib/i18n/fr'
import { dropSwrCache } from '@/lib/swr'
import MiniStrip from '@/components/app/MiniStrip'

// Bannière démo, refaite sur la grammaire MiniStrip (décision n°9) : hint
// mineur prioritaire sur tout, jamais dismissable — c'est l'état démo, et le
// CTA de conversion (quitter → créer son foyer) doit rester visible.
//
// Reste STICKY, contrairement aux autres hints : la sortie de démo doit être
// atteignable en bas de page comme en haut (c'est le seul chemin de
// conversion). Elle absorbe aussi le notch — d'où l'absence de padding
// safe-area sur le <main> en démo (cf. (app)/layout.tsx).
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
      <MiniStrip
        icon={<Sparkles size={15} />}
        label={t.demo.banner}
        action={
          <button
            type="button"
            onClick={handleExit}
            disabled={loading}
            className="min-h-8 shrink-0 px-1 text-[12.5px] font-semibold text-accent transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {loading ? '…' : t.demo.exit}
          </button>
        }
      />
    </div>
  )
}
