'use client'

import { useState, useEffect, useRef } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { t } from '@/lib/i18n/fr'

type Props = {
  value: string
  onSave: (newValue: string) => Promise<void>
  readOnly?: boolean
}

export default function InlineEditableField({ value, onSave, readOnly = false }: Props) {
  const [mode, setMode] = useState<'display' | 'edit'>('display')
  const [editValue, setEditValue] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mode === 'edit') {
      inputRef.current?.focus()
    }
  }, [mode])

  const enterEdit = () => {
    setEditValue(value)
    setError(null)
    setMode('edit')
  }

  const cancel = () => {
    setMode('display')
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') cancel()
  }

  const handleSave = async () => {
    const trimmed = editValue.trim()
    if (!trimmed) {
      setError('Le nom ne peut pas être vide')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await onSave(trimmed)
      setMode('display')
    } catch (err) {
      setError(err instanceof Error ? err.message : t.household.renameError)
    } finally {
      setIsSaving(false)
    }
  }

  if (mode === 'display') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xl font-semibold text-foreground">{value}</span>
        {!readOnly && (
          <button
            type="button"
            onClick={enterEdit}
            aria-label={t.household.rename}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil size={16} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={50}
          disabled={isSaving}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xl font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          aria-label={t.actions.save}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-accent transition-colors hover:bg-muted disabled:opacity-50"
        >
          {isSaving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : (
            <Check size={18} />
          )}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={isSaving}
          aria-label={t.actions.cancel}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <X size={18} />
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
