'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { t } from '@/lib/i18n/fr'
import { startDemoSession } from '@/app/actions/auth'
import CreateHouseholdForm from './CreateHouseholdForm'
import CodeEntryForm from './CodeEntryForm'

type View = 'menu' | 'create' | 'join'

function DemoButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-[44px] items-center justify-center rounded-xl bg-accent px-6 text-base font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {pending ? '…' : t.landing.tryApp}
    </button>
  )
}

export default function LandingScreen() {
  const [view, setView] = useState<View>('menu')

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
        {/* Primary: Demo */}
        <form action={startDemoSession}>
          <DemoButton />
        </form>

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
