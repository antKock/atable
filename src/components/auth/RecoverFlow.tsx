'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Mail } from 'lucide-react'
import { t } from '@/lib/i18n/fr'
import { dropSwrCache } from '@/lib/swr'
import RecoveryCodeInput from './RecoveryCodeInput'

type Props = {
  onBack: () => void
}

type Step = 'email' | 'sent'

const RESEND_DELAY_S = 60

// Récupération par email (#14, maquettes 1.3 + 1.4) : saisie → « Vérifie tes
// mails » (écran STRICTEMENT identique que l'email existe ou non — anti-
// énumération) avec repli code 6 chiffres pour les mails lus sur un autre
// appareil (jar WKWebView ≠ Safari).
export default function RecoverFlow({ onBack }: Props) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resendLeft, setResendLeft] = useState(RESEND_DELAY_S)
  const submitted = useRef(false)

  useEffect(() => {
    if (step !== 'sent' || resendLeft <= 0) return
    const timer = setInterval(() => setResendLeft((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [step, resendLeft])

  useEffect(() => {
    if (code.length !== 6 || submitted.current) return
    submitted.current = true
    void verify(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  async function request(): Promise<boolean> {
    const res = await fetch('/api/recovery/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) throw new Error(t.recovery.rateLimited)
      throw new Error((data as { error?: string }).error ?? t.recovery.sendError)
    }
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      await request()
      setStep('sent')
      setResendLeft(RESEND_DELAY_S)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.recovery.sendError)
    } finally {
      setSending(false)
    }
  }

  async function resend() {
    if (resendLeft > 0 || sending) return
    setSending(true)
    setError(null)
    try {
      await request()
      setResendLeft(RESEND_DELAY_S)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.recovery.sendError)
    } finally {
      setSending(false)
    }
  }

  async function verify(value: string) {
    setVerifying(true)
    setError(null)
    try {
      const res = await fetch('/api/recovery/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 429) throw new Error(t.recovery.rateLimited)
        throw new Error((data as { error?: string }).error ?? t.recovery.codeInvalid)
      }
      // Session récupérée : le cache d'une éventuelle session précédente est
      // périmé.
      dropSwrCache()
      window.location.href = (data as { redirect?: string }).redirect ?? '/home'
    } catch (err) {
      setError(err instanceof Error ? err.message : t.recovery.codeInvalid)
      setCode('')
      submitted.current = false
      setVerifying(false)
    }
  }

  const backButton = (
    <button
      type="button"
      onClick={step === 'sent' ? () => { setStep('email'); setError(null); setCode(''); submitted.current = false } : onBack}
      aria-label={t.a11y.backButton}
      className="fixed left-2 z-10 flex h-10 w-10 items-center justify-center text-foreground"
      style={{ top: 'calc(env(safe-area-inset-top) + 13px)' }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )

  if (step === 'sent') {
    return (
      <div className="fixed inset-0 flex flex-col overflow-y-auto bg-gradient-to-b from-background to-[#EDE8E0]">
        {backButton}
        <div
          className="mx-auto flex w-full max-w-[400px] flex-col items-center px-6 text-center"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 64px)' }}
        >
          <div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent/15 text-accent">
            <Mail size={33} aria-hidden="true" />
          </div>
          <h1
            className="text-foreground"
            style={{
              fontFamily: 'var(--font-fraunces), "Times New Roman", serif',
              fontVariationSettings: '"opsz" 144',
              fontWeight: 600,
              fontSize: 25,
              letterSpacing: '-0.02em',
            }}
          >
            {t.recovery.checkTitle}
          </h1>
          <p className="mt-3 max-w-[272px] text-sm leading-relaxed text-muted-foreground">
            {t.recovery.checkBody}
          </p>
          <p className="mt-1.5 text-[14.5px] font-semibold text-foreground">{email.trim()}</p>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">{t.recovery.checkHint}</p>

          <div
            className="mt-6 w-full rounded-[14px] bg-muted/50 p-4"
            style={{ boxShadow: 'inset 0 0 0 1px var(--border)' }}
          >
            <p className="text-[12.5px] leading-normal text-muted-foreground">
              <strong className="text-foreground">{t.recovery.codePrompt}</strong>{' '}
              {t.recovery.codePromptHint}
            </p>
            <div className="mt-3">
              <RecoveryCodeInput
                value={code}
                onChange={setCode}
                label={t.recovery.codeLabel}
                disabled={verifying}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-[13.5px] text-destructive">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={resend}
            disabled={resendLeft > 0 || sending}
            className="mb-8 mt-4 min-h-11 text-sm font-medium text-muted-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {resendLeft > 0 ? t.recovery.resendIn(resendLeft) : t.recovery.resend}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-background to-[#EDE8E0]">
      {backButton}
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col px-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 93px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <h1
          className="text-foreground"
          style={{
            fontFamily: 'var(--font-fraunces), "Times New Roman", serif',
            fontVariationSettings: '"opsz" 144',
            fontWeight: 700,
            fontSize: '32px',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          {t.recovery.title}
        </h1>

        <p
          style={{
            marginTop: '14px',
            color: 'rgba(26, 26, 24, 0.55)',
            fontWeight: 400,
            fontSize: '15.5px',
            lineHeight: 1.5,
            maxWidth: '320px',
          }}
        >
          {t.recovery.body}
        </p>

        <div className="relative" style={{ marginTop: '28px' }}>
          <span
            className="pointer-events-none absolute top-1/2 -translate-y-1/2"
            style={{ left: '15px', color: 'rgba(26, 26, 24, 0.55)' }}
            aria-hidden="true"
          >
            <Mail size={19} />
          </span>
          <input
            type="email"
            aria-label={t.profile.emailLabel}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError(null)
            }}
            placeholder={t.recovery.emailPlaceholder}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={sending}
            enterKeyHint="go"
            className="w-full bg-surface text-foreground placeholder:text-[rgba(26,26,24,0.32)] focus:outline-none disabled:opacity-50"
            style={{
              height: '54px',
              borderRadius: '14px',
              paddingLeft: '46px',
              paddingRight: '18px',
              fontWeight: 500,
              fontSize: '16px',
              boxShadow: 'inset 0 0 0 1.5px rgba(26, 26, 24, 0.12)',
            }}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="text-destructive"
            style={{ marginTop: '10px', fontSize: '13.5px', lineHeight: 1.4 }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!email.trim() || sending}
          className="w-full bg-primary text-primary-foreground transition-opacity disabled:opacity-50"
          style={{
            marginTop: '18px',
            height: '54px',
            borderRadius: '27px',
            fontWeight: 600,
            fontSize: '17px',
            letterSpacing: '-0.005em',
          }}
        >
          {sending ? '…' : t.recovery.send}
        </button>
      </form>
    </div>
  )
}
