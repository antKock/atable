'use client'

import { useState } from 'react'
import { t } from '@/lib/i18n/fr'

type Props = {
  onCancel: () => void
}

export default function CreateHouseholdForm({ onCancel }: Props) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })

      if (response.ok) {
        const data = await response.json()
        window.location.href = data.redirectTo ?? '/home'
        return
      }

      const data = await response.json()
      throw new Error(data.error ?? t.household.createError)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.household.createError)
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <h2 className="text-xl font-semibold text-foreground">
        {t.household.createTitle}
      </h2>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="household-name"
          className="text-sm font-medium text-foreground"
        >
          {t.household.nameLabel}
        </label>
        <input
          id="household-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.household.namePlaceholder}
          maxLength={50}
          required
          autoFocus
          className="min-h-[44px] rounded-lg border border-border bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="min-h-[44px] flex-1 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {t.actions.cancel}
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="min-h-[44px] flex-1 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? '…' : t.actions.save}
        </button>
      </div>
    </form>
  )
}
