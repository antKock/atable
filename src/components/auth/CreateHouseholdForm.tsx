'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { t } from '@/lib/i18n/fr'

type Props = {
  onCancel: () => void
  // When provided, called on successful creation instead of the default
  // navigation — lets a caller run follow-up work (e.g. saving a shared recipe
  // into the just-created household) before redirecting.
  onSuccess?: (data: { redirect?: string }) => void | Promise<void>
  // Optional content rendered above the title (e.g. the share "recipe to save"
  // card). Default cold-onboarding usage leaves this empty.
  headerSlot?: ReactNode
  // Optional override of the bottom secondary link. Defaults to a Cancel button
  // wired to onCancel; the share flow swaps it for "join an existing foyer".
  secondary?: { label: ReactNode; onClick: () => void }
}

export default function CreateHouseholdForm({ onCancel, onSuccess, headerSlot, secondary }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError((data as { error?: string }).error ?? t.household.createError)
        setSubmitting(false)
        return
      }
      if (onSuccess) {
        await onSuccess(data as { redirect?: string })
        return
      }
      window.location.href = (data as { redirect?: string }).redirect ?? '/home'
    } catch {
      setError(t.household.createError)
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
          Donne un nom
          <br />
          à ton foyer
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
          Tu pourras inviter d&apos;autres personnes à le rejoindre.
          Tes recettes seront partagées au sein du foyer.
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
              <path d="M3 12 12 3l9 9" />
              <path d="M5 10v10h14V10" />
              <path d="M10 20v-6h4v6" />
            </svg>
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError(null)
            }}
            placeholder={t.household.namePlaceholder}
            maxLength={50}
            autoFocus
            autoCorrect="off"
            spellCheck={false}
            disabled={submitting}
            enterKeyHint="go"
            className="w-full bg-surface text-foreground placeholder:text-[rgba(26,26,24,0.32)] focus:outline-none disabled:opacity-50"
            style={{
              height: '60px',
              borderRadius: '14px',
              paddingLeft: '50px',
              paddingRight: '18px',
              fontWeight: 500,
              fontSize: '17px',
              letterSpacing: '-0.01em',
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
          disabled={!name.trim() || submitting}
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
          {submitting ? '…' : 'Créer le foyer'}
        </button>

        <button
          type="button"
          onClick={secondary ? secondary.onClick : onCancel}
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
          {secondary ? secondary.label : t.actions.cancel}
        </button>
      </form>
    </div>
  )
}
