'use client'

import { useState } from 'react'
import Link from 'next/link'
import { t } from '@/lib/i18n/fr'

type Props = {
  householdName: string
  joinCode: string
}

export default function JoinConfirmation({ householdName, joinCode }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleJoin() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/households/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode }),
        redirect: 'follow',
      })

      if (response.redirected) {
        window.location.href = response.url
        return
      }

      if (!response.ok) {
        const data = await response.json()
        setError(data.error ?? t.joinLink.notFound)
        setLoading(false)
      }
    } catch {
      setError(t.joinLink.notFound)
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-bold text-foreground">
        {t.joinLink.hero(householdName)}
      </h1>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <button
        type="button"
        onClick={handleJoin}
        disabled={loading}
        className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-accent px-6 text-base font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {loading ? '…' : t.joinLink.confirm}
      </button>

      <Link
        href="/"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        {t.joinLink.backToLanding}
      </Link>
    </div>
  )
}
