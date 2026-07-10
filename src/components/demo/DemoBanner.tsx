'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { dropSwrCache } from '@/lib/swr'
import MiniStrip from '@/components/app/MiniStrip'

// Bannière démo, refaite sur la grammaire MiniStrip (décision n°9) : hint
// mineur prioritaire sur tout, jamais dismissable — c'est l'état démo, et le
// CTA de conversion (quitter → créer son foyer) doit rester visible.
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
    <MiniStrip
      icon={<Sparkles size={15} />}
      label="Mode démo — tes recettes ne seront pas conservées"
      action={
        <button
          type="button"
          onClick={handleExit}
          disabled={loading}
          className="min-h-8 shrink-0 px-1 text-[12.5px] font-semibold text-accent transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {loading ? '…' : 'Quitter la démo'}
        </button>
      }
    />
  )
}
