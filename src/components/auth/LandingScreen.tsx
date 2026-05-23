'use client'

import { useState } from 'react'
import Image from 'next/image'
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
      const response = await fetch('/api/demo/session', { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error((data as { error?: string }).error ?? 'Erreur serveur')
      }
      window.location.href = (data as { redirect?: string }).redirect ?? '/home'
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
      {/* Brand mark */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-10">
        <Image
          src="/icons/icon-512.png"
          alt="Mijote"
          width={160}
          height={160}
          priority
          className="h-40 w-40 sm:h-44 sm:w-44"
        />
        <h1
          className="mt-6 text-5xl font-bold tracking-tight text-foreground"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {t.landing.title}
        </h1>
        <p className="mt-3 text-center text-lg text-foreground">
          {t.landing.tagline}
        </p>
        <p
          className="mt-1 text-center text-base italic text-accent"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {t.landing.subtitle}
        </p>
      </div>

      {/* CTAs */}
      <div className="flex w-full flex-col items-center gap-6 px-6 pb-12">
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
