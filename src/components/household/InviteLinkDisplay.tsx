'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { t } from '@/lib/i18n/fr'

type Props = {
  joinCode: string
}

export default function InviteLinkDisplay({ joinCode }: Props) {
  const [copied, setCopied] = useState(false)

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/join/${joinCode}`
      : `https://atable.app/join/${joinCode}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
    } catch {
      const el = document.createElement('textarea')
      el.value = inviteUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.household.inviteLink}
        </p>
        <p className="mt-0.5 truncate text-sm text-foreground">{inviteUrl}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? t.household.copied : t.household.copy}
        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-accent transition-colors hover:bg-accent/10"
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
      </button>
    </div>
  )
}
