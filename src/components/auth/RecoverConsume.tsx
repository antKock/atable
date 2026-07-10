'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { t } from '@/lib/i18n/fr'
import { dropSwrCache } from '@/lib/swr'

type Props = {
  token: string
}

// Consommation du magic-link /recover/<token> (#14) : POST au montage (le
// token est single-use côté serveur, le ref pare le double-effect du dev
// StrictMode). Fonctionne aussi dans l'app via Universal Link : c'est le
// WebView qui navigue, donc le cookie se pose au bon endroit.
export default function RecoverConsume({ token }: Props) {
  const [failed, setFailed] = useState(false)
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    void (async () => {
      try {
        const res = await fetch('/api/recovery/consume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error()
        dropSwrCache() // nouvelle identité : cache d'une session précédente périmé
        window.location.href = (data as { redirect?: string }).redirect ?? '/home'
      } catch {
        setFailed(true)
      }
    })()
  }, [token])

  if (!failed) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <p className="text-base text-muted-foreground">{t.recovery.consuming}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-base font-semibold text-foreground">
        {t.recovery.consumeErrorTitle}
      </p>
      <p className="max-w-[300px] text-sm leading-relaxed text-muted-foreground">
        {t.recovery.consumeErrorBody}
      </p>
      <Link
        href="/"
        className="mt-1 text-sm text-accent underline underline-offset-4 hover:opacity-80"
      >
        {t.recovery.backToLanding}
      </Link>
    </div>
  )
}
