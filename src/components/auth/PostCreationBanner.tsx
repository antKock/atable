'use client'

import { useState } from 'react'
import { Share2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { t } from '@/lib/i18n/fr'

type Props = {
  householdName: string
  code: string
}

export default function PostCreationBanner({ householdName, code }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = `${window.location.origin}/join/${code}`

    if (navigator.share) {
      try {
        await navigator.share({ title: t.household.shareTitle(householdName), url })
        return
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t.household.inviteLinkCopied)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  }

  return (
    <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {t.household.createSuccess(householdName)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t.household.inviteCodeLabel} : <span className="font-mono font-medium text-foreground">{code}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={handleShare}
        aria-label={copied ? t.household.copied : t.household.copy}
        className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-lg text-accent transition-colors hover:bg-accent/20"
      >
        {copied ? <Check size={18} /> : <Share2 size={18} />}
      </button>
    </div>
  )
}
