'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { t } from '@/lib/i18n/fr'
import { Button } from '@/components/ui/button'
import MergeVerifyScreen from './MergeVerifyScreen'

type Props = {
  initialName: string
  // Alias auto dérivé de l'owner id — sert de placeholder : nom vide → c'est
  // lui qui s'affiche partout (jamais stocké en DB).
  alias: string
  // Email de secours actuel (#14) — vide si jamais posé.
  initialEmail: string
}

// Profil « Toi » (maquette 0.3) : nom + email de secours, UN enregistrement.
// Saisir l'email n'envoie RIEN (décision n°1) ; s'il appartient à un autre
// owner, le serveur répond { merge: true } → écran « On réunit tes foyers ».
export default function ProfileForm({ initialName, alias, initialEmail }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [savedName, setSavedName] = useState(initialName)
  const [savedEmail, setSavedEmail] = useState(initialEmail)
  const [saving, setSaving] = useState(false)
  const [mergeEmail, setMergeEmail] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      if (name.trim() !== savedName) {
        const res = await fetch('/api/owner', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error ?? t.profile.saveError)
        }
        setSavedName(name.trim())
      }

      if (email.trim().toLowerCase() !== savedEmail.toLowerCase()) {
        const res = await fetch('/api/owner/email', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error((data as { error?: string }).error ?? t.profile.saveError)
        }
        if ((data as { merge?: boolean }).merge) {
          // L'email appartient à un autre profil → vérification avant fusion.
          setMergeEmail(email.trim().toLowerCase())
          return
        }
        setSavedEmail(((data as { email?: string | null }).email ?? '') || '')
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

  if (mergeEmail) {
    return <MergeVerifyScreen email={mergeEmail} onCancel={() => setMergeEmail(null)} />
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

        <p className="mb-2 mt-7 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.profile.emailSection}
        </p>
        <div className="relative">
          <span
            className="pointer-events-none absolute top-1/2 -translate-y-1/2"
            style={{ left: '15px', color: 'rgba(26, 26, 24, 0.5)' }}
            aria-hidden="true"
          >
            <Mail size={19} />
          </span>
          <input
            id="owner-email"
            type="email"
            aria-label={t.profile.emailLabel}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.profile.emailPlaceholder}
            maxLength={254}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={saving}
            enterKeyHint="done"
            className="w-full rounded-[14px] bg-surface pr-4 text-foreground placeholder:text-[rgba(26,26,24,0.32)] focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            style={{
              height: '54px',
              paddingLeft: '46px',
              fontWeight: 500,
              fontSize: '16px',
              boxShadow: 'inset 0 0 0 1.5px rgba(26, 26, 24, 0.12)',
            }}
          />
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
          {t.profile.emailHint}
        </p>

        <Button type="submit" disabled={saving} className="mt-6 min-h-11 w-full">
          {saving ? '…' : t.actions.save}
        </Button>
      </form>
    </div>
  )
}
