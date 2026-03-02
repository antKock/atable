'use client'

import { useState, useEffect } from 'react'
import { t } from '@/lib/i18n/fr'

const CODE_REGEX = /^[A-Z]+-\d{4}$/

type JoinState =
  | { phase: 'entry'; error?: string }
  | { phase: 'loading' }
  | { phase: 'preview'; householdName: string }
  | { phase: 'joining' }

type Props = {
  onCancel: () => void
}

export default function CodeEntryForm({ onCancel }: Props) {
  const [code, setCode] = useState('')
  const [state, setState] = useState<JoinState>({ phase: 'entry' })

  // Auto-lookup when code matches valid format
  useEffect(() => {
    if (!CODE_REGEX.test(code)) return

    let cancelled = false
    setState({ phase: 'loading' })

    fetch(`/api/households/lookup?code=${encodeURIComponent(code)}`)
      .then(async (res) => {
        if (cancelled) return
        const data = await res.json()
        if (res.ok) {
          setState({ phase: 'preview', householdName: data.householdName })
        } else if (res.status === 429) {
          setState({ phase: 'entry', error: t.join.rateLimited })
        } else {
          setState({ phase: 'entry', error: data.error ?? t.join.notFound })
        }
      })
      .catch(() => {
        if (!cancelled) setState({ phase: 'entry', error: t.join.notFound })
      })

    return () => { cancelled = true }
  }, [code])

  async function handleJoin() {
    if (state.phase !== 'preview') return
    setState({ phase: 'joining' })

    try {
      const response = await fetch('/api/households/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      if (response.ok) {
        window.location.href = '/home'
        return
      }

      const data = await response.json()
      const error = response.status === 429 ? t.join.rateLimited : (data.error ?? t.join.notFound)
      setState({ phase: 'entry', error })
      setCode('')
    } catch {
      setState({ phase: 'entry', error: t.join.notFound })
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <h2 className="text-xl font-semibold text-foreground">{t.join.enterCode}</h2>

      <input
        type="text"
        value={code}
        onChange={(e) => {
          const upper = e.target.value.toUpperCase()
          setCode(upper)
          if (state.phase === 'entry' && state.error) {
            setState({ phase: 'entry' })
          }
        }}
        placeholder={t.join.placeholder}
        autoFocus
        disabled={state.phase === 'loading' || state.phase === 'joining'}
        className="min-h-[44px] rounded-lg border border-border bg-background px-3 font-mono text-base text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
      />

      {/* Inline validation hint */}
      {code && !CODE_REGEX.test(code) && state.phase === 'entry' && (
        <p className="text-sm text-muted-foreground">{t.join.invalidFormat}</p>
      )}

      {/* Error */}
      {state.phase === 'entry' && state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      {/* Loading */}
      {state.phase === 'loading' && (
        <p className="text-sm text-muted-foreground">{t.join.searching}</p>
      )}

      {/* Preview */}
      {state.phase === 'preview' && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            {t.join.preview(state.householdName)}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={state.phase === 'joining'}
          className="min-h-[44px] flex-1 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {t.actions.cancel}
        </button>

        {state.phase === 'preview' && (
          <button
            type="button"
            onClick={handleJoin}
            className="min-h-[44px] flex-1 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            {t.join.confirm}
          </button>
        )}

        {state.phase === 'joining' && (
          <button
            disabled
            className="min-h-[44px] flex-1 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground opacity-50"
          >
            …
          </button>
        )}
      </div>
    </div>
  )
}
