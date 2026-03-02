'use client'

import { useState, useEffect, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { t } from '@/lib/i18n/fr'
import { joinHousehold } from '@/app/actions/auth'

const CODE_REGEX = /^[A-Z]+-\d{4}$/

type LookupState =
  | { phase: 'entry'; error?: string }
  | { phase: 'loading' }
  | { phase: 'preview'; householdName: string }

type Props = {
  onCancel: () => void
}

function JoinButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] flex-1 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? '…' : t.join.confirm}
    </button>
  )
}

export default function CodeEntryForm({ onCancel }: Props) {
  const [code, setCode] = useState('')
  const [lookup, setLookup] = useState<LookupState>({ phase: 'entry' })
  const [joinState, joinAction] = useActionState(joinHousehold, null)

  // Auto-lookup when code matches valid format
  useEffect(() => {
    if (!CODE_REGEX.test(code)) return

    let cancelled = false
    setLookup({ phase: 'loading' })

    fetch(`/api/households/lookup?code=${encodeURIComponent(code)}`)
      .then(async (res) => {
        if (cancelled) return
        const data = await res.json()
        if (res.ok) {
          setLookup({ phase: 'preview', householdName: data.householdName })
        } else if (res.status === 429) {
          setLookup({ phase: 'entry', error: t.join.rateLimited })
        } else {
          setLookup({ phase: 'entry', error: data.error ?? t.join.notFound })
        }
      })
      .catch(() => {
        if (!cancelled) setLookup({ phase: 'entry', error: t.join.notFound })
      })

    return () => { cancelled = true }
  }, [code])

  // Surface join errors back to entry phase
  const displayError =
    (lookup.phase === 'entry' && lookup.error) ||
    (joinState?.error ?? null)

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <h2 className="text-xl font-semibold text-foreground">{t.join.enterCode}</h2>

      <input
        type="text"
        value={code}
        onChange={(e) => {
          const upper = e.target.value.toUpperCase()
          setCode(upper)
          if (lookup.phase === 'entry' && lookup.error) {
            setLookup({ phase: 'entry' })
          }
        }}
        placeholder={t.join.placeholder}
        autoFocus
        disabled={lookup.phase === 'loading'}
        className="min-h-[44px] rounded-lg border border-border bg-background px-3 font-mono text-base text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
      />

      {/* Inline validation hint */}
      {code && !CODE_REGEX.test(code) && lookup.phase === 'entry' && (
        <p className="text-sm text-muted-foreground">{t.join.invalidFormat}</p>
      )}

      {/* Error */}
      {displayError && (
        <p className="text-sm text-destructive">{displayError}</p>
      )}

      {/* Loading */}
      {lookup.phase === 'loading' && (
        <p className="text-sm text-muted-foreground">{t.join.searching}</p>
      )}

      {/* Preview + join form */}
      {lookup.phase === 'preview' && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            {t.join.preview(lookup.householdName)}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] flex-1 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {t.actions.cancel}
        </button>

        {lookup.phase === 'preview' && (
          <form action={joinAction}>
            <input type="hidden" name="code" value={code} />
            <JoinButton />
          </form>
        )}
      </div>
    </div>
  )
}
