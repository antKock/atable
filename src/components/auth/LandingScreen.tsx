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
    <div className="flex w-full max-w-sm flex-col items-center gap-6 px-6">
      {/* Brand */}
      <div className="mb-2 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="text-foreground">a</span>
          <span className="text-accent">table</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.landing.subtitle}</p>
      </div>

      {/* CTAs */}
      <div className="flex w-full flex-col gap-3">
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

        {/* Secondary: Join */}
        <button
          type="button"
          onClick={() => setView('join')}
          className="flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-background px-6 text-base font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t.landing.joinHousehold}
        </button>
      </div>
    </div>
  )
}
