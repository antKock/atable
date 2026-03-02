'use client'

import { useState } from 'react'

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
        window.location.href = response.url
        return
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b border-accent/30 bg-accent/10 px-4 py-2">
      <p className="text-xs font-medium text-accent">
        Mode démo — vos recettes ne seront pas conservées
      </p>
      <button
        type="button"
        onClick={handleExit}
        disabled={loading}
        className="min-h-[44px] shrink-0 rounded-lg px-3 text-xs font-semibold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
      >
        {loading ? '…' : 'Quitter la démo'}
      </button>
    </div>
  )
}
