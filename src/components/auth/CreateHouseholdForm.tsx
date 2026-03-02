'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { t } from '@/lib/i18n/fr'
import { createHousehold } from '@/app/actions/auth'

type Props = {
  onCancel: () => void
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] flex-1 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? '…' : t.actions.save}
    </button>
  )
}

export default function CreateHouseholdForm({ onCancel }: Props) {
  const [state, formAction] = useActionState(createHousehold, null)

  return (
    <form
      action={formAction}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <h2 className="text-xl font-semibold text-foreground">
        {t.household.createTitle}
      </h2>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="household-name"
          className="text-sm font-medium text-foreground"
        >
          {t.household.nameLabel}
        </label>
        <input
          id="household-name"
          name="name"
          type="text"
          placeholder={t.household.namePlaceholder}
          maxLength={50}
          required
          autoFocus
          className="min-h-[44px] rounded-lg border border-border bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] flex-1 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {t.actions.cancel}
        </button>
        <SubmitButton />
      </div>
    </form>
  )
}
