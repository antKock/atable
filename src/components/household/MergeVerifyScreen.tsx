'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n/client'
import BackButton from '@/components/ui/BackButton'
import { apiRequest } from '@/lib/api-client'
import { hardNavigate } from '@/lib/navigate'
import { dropSwrCache } from '@/lib/swr'
import RecoveryCodeInput from '@/components/auth/RecoveryCodeInput'

type Props = {
  // Email déjà normalisé (celui qui a déclenché la collision au profil)
  email: string
  onCancel: () => void
}

const RESEND_DELAY_S = 60

// « On réunit tes foyers » (#14 §5, maquette VerifyScreen merge) : l'email
// saisi au profil appartient à un autre owner — code envoyé à cette adresse,
// la vérification fusionne les deux identités (la session courante est
// absorbée par l'owner cible, le cookie reste valide).
export default function MergeVerifyScreen({ email, onCancel }: Props) {
  const t = useT()
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendLeft, setResendLeft] = useState(RESEND_DELAY_S)
  const [resending, setResending] = useState(false)
  const submitted = useRef(false)

  useEffect(() => {
    if (resendLeft <= 0) return
    const timer = setInterval(() => setResendLeft((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [resendLeft])

  useEffect(() => {
    if (code.length !== 6 || submitted.current) return
    submitted.current = true
    void verify(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  async function verify(value: string) {
    setVerifying(true)
    setError(null)
    try {
      const data = await apiRequest<{ redirect?: string }>('/api/owner/email/verify', {
        body: { email, code: value },
        fallbackError: t.merge.codeInvalid,
      })
      toast.success(t.merge.success, { duration: 2500 })
      // L'identité vient de changer (union des foyers) : cache SWR périmé.
      dropSwrCache()
      hardNavigate(data.redirect ?? '/household')
    } catch (err) {
      setError(err instanceof Error ? err.message : t.merge.codeInvalid)
      setCode('')
      submitted.current = false
      setVerifying(false)
    }
  }

  async function resend() {
    if (resendLeft > 0 || resending) return
    setResending(true)
    setError(null)
    try {
      // Re-déclenche le même chemin collision → nouveau token + nouvel email
      await apiRequest('/api/owner/email', {
        method: 'PUT',
        body: { email },
        fallbackError: t.recovery.sendError,
      })
      setResendLeft(RESEND_DELAY_S)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.recovery.sendError)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-4">
      <BackButton onClick={onCancel} />

      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent/15 text-accent">
          <CheckCircle2 size={33} aria-hidden="true" />
        </div>
        <h1
          className="display text-foreground"
          style={{
            fontSize: 25,
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          {t.merge.title}
        </h1>
        <p className="mt-3 max-w-[290px] text-sm leading-relaxed text-muted-foreground">
          {t.merge.body(email)}
        </p>

        <div
          className="mt-6 w-full rounded-[14px] bg-muted/50 p-4"
          style={{ boxShadow: 'inset 0 0 0 1px var(--border)' }}
        >
          <RecoveryCodeInput
            value={code}
            onChange={setCode}
            label={t.merge.codeLabel}
            disabled={verifying}
          />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-[13.5px] text-destructive">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={resend}
          disabled={resendLeft > 0 || resending}
          className="mt-4 min-h-11 text-sm font-medium text-muted-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {resendLeft > 0 ? t.recovery.resendIn(resendLeft) : t.recovery.resend}
        </button>
      </div>
    </div>
  )
}
