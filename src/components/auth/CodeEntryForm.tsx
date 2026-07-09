'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { t } from '@/lib/i18n/fr'
import { dropSwrCache } from '@/lib/swr'

type Props = {
  onCancel: () => void
  // When provided, called on successful join instead of the default navigation
  // — lets a caller run follow-up work (e.g. saving a shared recipe into the
  // joined household) before redirecting.
  onSuccess?: (data: { redirect?: string }) => void | Promise<void>
  // Optional content rendered above the title (e.g. the share "recipe to save"
  // card). Default cold-onboarding usage leaves this empty.
  headerSlot?: ReactNode
}

export default function CodeEntryForm({ onCancel, onSuccess, headerSlot }: Props) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!code || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/households/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 429) setError(t.join.rateLimited)
        else if (response.status === 400) setError(t.join.invalidFormat)
        else setError((data as { error?: string }).error ?? t.join.notFound)
        setSubmitting(false)
        return
      }
      // Joined a household: drop any cached data from a previous session
      dropSwrCache()
      if (onSuccess) {
        await onSuccess(data as { redirect?: string })
        return
      }
      window.location.href = (data as { redirect?: string }).redirect ?? '/home'
    } catch {
      setError(t.join.notFound)
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-background to-[#EDE8E0]"
    >
      <button
        type="button"
        onClick={onCancel}
        aria-label={t.a11y.backButton}
        className="fixed left-2 z-10 flex h-10 w-10 items-center justify-center text-foreground"
        style={{ top: 'calc(env(safe-area-inset-top) + 13px)' }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col px-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 93px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        {headerSlot && <div style={{ marginBottom: 22 }}>{headerSlot}</div>}

        <h1
          className="text-foreground"
          style={{
            fontFamily: 'var(--font-fraunces), "Times New Roman", serif',
            fontVariationSettings: '"opsz" 144',
            fontWeight: 700,
            fontSize: '38px',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          Entre le code
          <br />
          de ton foyer
        </h1>

        <p
          style={{
            marginTop: '14px',
            color: 'rgba(26, 26, 24, 0.55)',
            fontWeight: 400,
            fontSize: '15.5px',
            lineHeight: 1.5,
            maxWidth: '320px',
          }}
        >
          Demande à un membre du foyer son code d&apos;invitation.
          Tu rejoindras instantanément la bibliothèque partagée.
        </p>

        <div className="relative" style={{ marginTop: '28px' }}>
          <span
            className="pointer-events-none absolute top-1/2 -translate-y-1/2"
            style={{ left: '14px', color: 'rgba(26, 26, 24, 0.55)' }}
            aria-hidden="true"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="8" cy="15" r="5" />
              <path d="m11.5 11.5 9-9" />
              <path d="m16 7 3 3" />
              <path d="m19 4 3 3" />
            </svg>
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              if (error) setError(null)
            }}
            placeholder={t.join.placeholder}
            autoFocus
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            disabled={submitting}
            inputMode="text"
            enterKeyHint="go"
            className="w-full bg-surface text-foreground placeholder:text-[rgba(26,26,24,0.32)] focus:outline-none disabled:opacity-50"
            style={{
              height: '60px',
              borderRadius: '14px',
              paddingLeft: '50px',
              paddingRight: '18px',
              fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
              fontWeight: 500,
              fontSize: '19px',
              letterSpacing: '0.08em',
              boxShadow: 'inset 0 0 0 1.5px rgba(26, 26, 24, 0.12)',
            }}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="text-destructive"
            style={{ marginTop: '10px', fontSize: '13.5px', lineHeight: 1.4 }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!code || submitting}
          className="w-full bg-primary text-primary-foreground transition-opacity disabled:opacity-50"
          style={{
            marginTop: '18px',
            height: '54px',
            borderRadius: '27px',
            fontWeight: 600,
            fontSize: '17px',
            letterSpacing: '-0.005em',
          }}
        >
          {submitting ? '…' : t.join.confirm}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="w-full bg-transparent text-foreground disabled:opacity-50"
          style={{
            marginTop: '8px',
            paddingTop: '14px',
            paddingBottom: '14px',
            fontWeight: 500,
            fontSize: '16px',
          }}
        >
          {t.actions.cancel}
        </button>
      </form>
    </div>
  )
}
