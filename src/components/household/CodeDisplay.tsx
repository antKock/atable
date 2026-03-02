'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { t } from '@/lib/i18n/fr'

type Props = {
  code: string
}

export default function CodeDisplay({ code }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      // Fallback
      const el = document.createElement('textarea')
      el.value = code
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
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.household.shareCode}
        </p>
        <p className="mt-0.5 font-mono text-lg font-semibold text-foreground">{code}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? t.household.copied : t.household.copy}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-accent transition-colors hover:bg-accent/10"
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
      </button>
    </div>
  )
}
