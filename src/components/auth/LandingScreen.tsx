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

  // Welcome / first-launch (Mijote onboarding 06-A). Sage hero is full-bleed
  // (extends behind status bar + home indicator), so we render fixed inset-0
  // and ignore the parent (landing)/layout safe-area padding.
  return (
    <div className="bg-sage-radial fixed inset-0 flex flex-col text-background">
      <div
        className="flex flex-1 flex-col items-center justify-center px-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 96px)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local SVG with internal Gaussian blur filter; next/image would force dangerouslyAllowSVG globally */}
        <img
          src="/cocotte-illustration.svg"
          alt=""
          aria-hidden="true"
          width={320}
          height={320}
          className="h-auto w-[min(320px,81vw)] select-none"
          draggable={false}
        />
        <h1
          className="mt-7 text-center"
          style={{
            fontFamily: 'var(--font-fraunces), "Times New Roman", serif',
            fontVariationSettings: '"opsz" 144',
            fontWeight: 700,
            fontSize: 'clamp(72px, 23vw, 92px)',
            lineHeight: 0.95,
            letterSpacing: '-0.025em',
          }}
        >
          {t.landing.title}
        </h1>
      </div>

      <div
        className="flex w-full flex-col gap-2.5 px-6"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)',
        }}
      >
        {demoError && (
          <p
            role="alert"
            className="text-center text-sm font-medium text-background"
          >
            {demoError}
          </p>
        )}

        {/* Primary — cream pill */}
        <button
          type="button"
          onClick={handleTryApp}
          disabled={demoLoading}
          className="flex h-[54px] items-center justify-center rounded-[27px] bg-background text-[17px] font-semibold tracking-[-0.005em] text-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          {demoLoading ? '…' : t.landing.tryApp}
        </button>

        {/* Secondary — ghost outlined pill (1.5px cream @55%) */}
        <button
          type="button"
          onClick={() => setView('create')}
          className="flex h-[54px] items-center justify-center rounded-[27px] bg-transparent text-[17px] font-semibold tracking-[-0.005em] text-background transition-colors hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70"
          style={{ boxShadow: 'inset 0 0 0 1.5px rgba(245, 241, 232, 0.55)' }}
        >
          {t.landing.createHousehold}
        </button>

        {/* Tertiary — text link */}
        <button
          type="button"
          onClick={() => setView('join')}
          className="flex w-full items-center justify-center bg-transparent py-[14px] text-[16px] font-medium text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70"
        >
          {t.landing.joinHousehold}
        </button>
      </div>
    </div>
  )
}
