'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n/client'
import BackButton from '@/components/ui/BackButton'
import { apiRequest } from '@/lib/api-client'
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
  const t = useT()
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
      // Deux requêtes séquentielles (nom puis email) sous un seul état
      // `saving` : apiRequest directement, le toast est commun ci-dessous.
      if (name.trim() !== savedName) {
        await apiRequest('/api/owner', {
          method: 'PUT',
          body: { name: name.trim() },
          fallbackError: t.profile.saveError,
        })
        setSavedName(name.trim())
      }

      if (email.trim().toLowerCase() !== savedEmail.toLowerCase()) {
        const data = await apiRequest<{ merge?: boolean; email?: string | null }>('/api/owner/email', {
          method: 'PUT',
          body: { email: email.trim() },
          fallbackError: t.profile.saveError,
        })
        if (data.merge) {
          // L'email appartient à un autre profil → vérification avant fusion.
          setMergeEmail(email.trim().toLowerCase())
          return
        }
        setSavedEmail(data.email ?? '')
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
      <BackButton href="/household" />

      <h1
        className="display-xl mb-6 text-foreground"
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
