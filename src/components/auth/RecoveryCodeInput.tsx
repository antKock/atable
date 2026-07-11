'use client'

import { useState } from 'react'

type Props = {
  value: string
  onChange: (code: string) => void
  label: string
  disabled?: boolean
}

// Saisie du code 6 chiffres (récup + fusion, maquettes 1.4) : 6 cases DM Mono,
// portées par UN vrai input invisible par-dessus (focus/clavier natifs,
// autoComplete one-time-code pour la suggestion iOS depuis Mail).
export default function RecoveryCodeInput({ value, onChange, label, disabled }: Props) {
  const [focused, setFocused] = useState(false)

  return (
    <div className="relative">
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div className="flex justify-center gap-2" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => {
          const isActive = focused && !disabled && i === Math.min(value.length, 5)
          return (
            <div
              key={i}
              className="flex h-12 w-[38px] items-center justify-center rounded-[10px] bg-surface text-xl font-medium text-foreground"
              style={{
                fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                boxShadow: `inset 0 0 0 1.5px ${isActive ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {value[i] ?? ''}
            </div>
          )
        })}
      </div>
    </div>
  )
}
