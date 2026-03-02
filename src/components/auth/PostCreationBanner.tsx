'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { t } from '@/lib/i18n/fr'

type Props = {
  householdName: string
  code: string
}

export default function PostCreationBanner({ householdName, code }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
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
          {t.household.code} : <span className="font-mono font-medium text-foreground">{code}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? t.household.copied : t.household.copy}
        className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-lg text-accent transition-colors hover:bg-accent/20"
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
      </button>
    </div>
  )
}
