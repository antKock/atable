'use client'

import { useState } from 'react'
import { t } from '@/lib/i18n/fr'
import CreateHouseholdForm from './CreateHouseholdForm'
import CodeEntryForm from './CodeEntryForm'

type View = 'menu' | 'create' | 'join'

export default function LandingScreen() {
  const [view, setView] = useState<View>('menu')
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)

  async function handleTryApp() {
    setDemoLoading(true)
    setDemoError(null)
    try {
      const response = await fetch('/api/demo/session', {
        method: 'POST',
        redirect: 'follow',
      })
      if (response.redirected) {
        window.location.href = response.url
        return
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Erreur serveur')
      }
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : 'Erreur serveur')
      setDemoLoading(false)
    }
  }

  if (view === 'create') {
    return <CreateHouseholdForm onCancel={() => setView('menu')} />
  }

  if (view === 'join') {
    return <CodeEntryForm onCancel={() => setView('menu')} />
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Illustration area */}
      <div className="flex flex-1 items-center justify-center px-8 py-12">
        <div style={{ width: 200, height: 200, position: 'relative' }}>
          {/* Spoon */}
          <div style={{ position: 'absolute', top: 40, left: 0, width: 8, height: 80, background: '#B8A88C', borderRadius: 4, transform: 'rotate(-15deg)' }}>
            <div style={{ position: 'absolute', top: -20, left: -6, width: 20, height: 28, background: '#B8A88C', borderRadius: '50%' }} />
          </div>
          {/* Cutting board */}
          <div style={{ position: 'absolute', bottom: 0, left: 20, width: 160, height: 120, background: '#D4C4A8', borderRadius: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
          {/* Leaf 1 */}
          <div style={{ position: 'absolute', top: 20, right: 10, width: 40, height: 60, background: '#6E7A38', borderRadius: '50% 0 50% 50%', transform: 'rotate(-30deg)', opacity: 0.7 }} />
          {/* Leaf 2 */}
          <div style={{ position: 'absolute', top: 10, right: 50, width: 30, height: 45, background: '#8B9A4A', borderRadius: '0 50% 50% 50%', transform: 'rotate(20deg)', opacity: 0.5 }} />
          {/* Tomato */}
          <div style={{ position: 'absolute', bottom: 30, right: 0, width: 36, height: 36, background: '#C4533A', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <div style={{ position: 'absolute', top: -4, left: 14, width: 8, height: 8, background: '#5A8030', borderRadius: 2 }} />
          </div>
        </div>
      </div>

      {/* Brand + CTAs */}
      <div className="flex w-full flex-col items-center gap-6 px-6 pb-12">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="text-foreground">a</span>
            <span className="text-accent">table</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.landing.subtitle}</p>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3">
          {demoError && (
            <p className="text-center text-sm text-destructive">{demoError}</p>
          )}

          {/* Primary: Demo */}
          <button
            type="button"
            onClick={handleTryApp}
            disabled={demoLoading}
            className="flex min-h-[44px] items-center justify-center rounded-xl bg-accent px-6 text-base font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {demoLoading ? '…' : t.landing.tryApp}
          </button>

          {/* Secondary: Create */}
          <button
            type="button"
            onClick={() => setView('create')}
            className="flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-background px-6 text-base font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t.landing.createHousehold}
          </button>

          {/* Tertiary: Join */}
          <button
            type="button"
            onClick={() => setView('join')}
            className="flex min-h-[44px] items-center justify-center rounded-xl px-6 text-base font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t.landing.joinHousehold}
          </button>
        </div>
      </div>
    </div>
  )
}
