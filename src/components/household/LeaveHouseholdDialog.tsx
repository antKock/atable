'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { t } from '@/lib/i18n/fr'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  householdId: string
}

// null = closed. 'leave' = single leave confirmation.
// 'delete-1' / 'delete-2' = the two steps of the delete double-confirmation.
type Step = null | 'leave' | 'delete-1' | 'delete-2'

export default function LeaveHouseholdDialog({ householdId }: Props) {
  const [step, setStep] = useState<Step>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const close = () => {
    if (!isSubmitting) setStep(null)
  }

  async function submit(action: 'leave' | 'delete') {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/households/${householdId}?action=${action}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? t.household.leaveError)
      }
      window.location.href = (data as { redirect?: string }).redirect ?? '/'
    } catch (err) {
      setStep(null)
      setIsSubmitting(false)
      toast.error(err instanceof Error ? err.message : t.household.leaveError, {
        duration: Infinity,
      })
    }
  }

  // Dialog copy + primary action, keyed by step.
  const dialogs = {
    leave: {
      title: t.household.leaveConfirm,
      body: t.household.leaveBody,
      action: t.household.leaveAction,
      onConfirm: () => submit('leave'),
    },
    'delete-1': {
      title: t.household.deleteConfirmTitle,
      body: t.household.deleteConfirmBody,
      action: t.household.deleteContinue,
      onConfirm: () => setStep('delete-2'),
    },
    'delete-2': {
      title: t.household.deleteFinalTitle,
      body: t.household.deleteFinalBody,
      action: t.household.deleteFinalAction,
      onConfirm: () => submit('delete'),
    },
  }
  const current = step ? dialogs[step] : null

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        type="button"
        onClick={() => setStep('leave')}
        className="min-h-[44px] text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {t.household.leaveHousehold}
      </Button>
      <Button
        variant="ghost"
        type="button"
        onClick={() => setStep('delete-1')}
        className="min-h-[44px] text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {t.household.deleteHousehold}
      </Button>

      <Dialog open={step !== null} onOpenChange={(open) => !open && close()}>
        {current && (
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>{current.title}</DialogTitle>
              <DialogDescription>{current.body}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={close}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                {t.actions.cancel}
              </Button>
              <Button
                variant="destructive"
                onClick={current.onConfirm}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                {current.action}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
