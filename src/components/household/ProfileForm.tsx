'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { t } from '@/lib/i18n/fr'
import { Button } from '@/components/ui/button'

type Props = {
  initialName: string
  // Alias auto dérivé de l'owner id — sert de placeholder : nom vide → c'est
  // lui qui s'affiche partout (jamais stocké en DB).
  alias: string
}

// Profil « Toi » (maquette 0.3) : le nom seulement à ce lot — l'email de
// secours arrive au Lot 2 avec la récupération + fusion.
export default function ProfileForm({ initialName, alias }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/owner', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? t.profile.saveError)
      }
      toast.success(t.profile.saved, { duration: 2500 })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.profile.saveError, {
        duration: Infinity,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-4">
      <Link
        href="/household"
        aria-label={t.a11y.backButton}
        className="mb-2 -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
      >
        <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
      </Link>

      <h1
        className="mb-6 text-foreground"
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontVariationSettings: '"opsz" 144',
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}
      >
        {t.profile.title}
      </h1>

      <form onSubmit={handleSubmit}>
        <label
          htmlFor="owner-name"
          className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          {t.profile.nameLabel}
        </label>
        <input
          id="owner-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={alias}
          maxLength={50}
          autoCorrect="off"
          spellCheck={false}
          disabled={saving}
          enterKeyHint="done"
          className="w-full rounded-[14px] bg-surface px-4 text-foreground placeholder:text-[rgba(26,26,24,0.32)] focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          style={{
            height: '54px',
            fontWeight: 500,
            fontSize: '17px',
            letterSpacing: '-0.01em',
            boxShadow: 'inset 0 0 0 1.5px rgba(26, 26, 24, 0.12)',
          }}
        />
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
          {t.profile.nameHint}
        </p>

        <Button type="submit" disabled={saving} className="mt-5 min-h-11 w-full">
          {saving ? '…' : t.actions.save}
        </Button>
      </form>
    </div>
  )
}
