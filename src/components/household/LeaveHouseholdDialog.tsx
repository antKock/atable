'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { useApiMutation } from '@/hooks/useApiMutation'
import { haptics } from '@/lib/haptics'
import { dropSwrCache } from '@/lib/swr'
import { hardNavigate } from '@/lib/navigate'
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
  // « Supprimer le foyer » est réservé aux membres (Lot 3) : un invité n'a que
  // « Quitter ». Défaut true = comportement Lot 1/2 (viewer membre).
  canDelete?: boolean
  // « Quitter » est masqué pour le DERNIER membre : partir supprimerait le foyer
  // (arbitrage 2026-07) alors que la copie promet de pouvoir rejoindre — on ne
  // laisse alors que « Supprimer » (copie honnête, double confirmation).
  canLeave?: boolean
}

// null = closed. 'leave' = single leave confirmation.
// 'delete-1' / 'delete-2' = the two steps of the delete double-confirmation.
type Step = null | 'leave' | 'delete-1' | 'delete-2'

export default function LeaveHouseholdDialog({ householdId, canDelete = true, canLeave = true }: Props) {
  const t = useT()
  const [step, setStep] = useState<Step>(null)
  const { run, loading: isSubmitting } = useApiMutation<{ redirect?: string }>({
    fallbackError: t.household.leaveError,
  })

  const close = () => {
    if (!isSubmitting) setStep(null)
  }

  async function submit(action: 'leave' | 'delete') {
    if (action === 'delete') void haptics.heavy()
    const data = await run(`/api/households/${householdId}?action=${action}`, { method: 'DELETE' })
    if (!data) {
      setStep(null)
      return
    }
    dropSwrCache() // left the household: its recipes must not survive in cache
    hardNavigate(data.redirect ?? '/')
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
      {canLeave && (
        <Button
          variant="ghost"
          type="button"
          onClick={() => setStep('leave')}
          className="min-h-11 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {t.household.leaveHousehold}
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          type="button"
          onClick={() => setStep('delete-1')}
          className="min-h-11 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {t.household.deleteHousehold}
        </Button>
      )}

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
                className="min-h-11"
              >
                {t.actions.cancel}
              </Button>
              <Button
                variant="destructive"
                onClick={current.onConfirm}
                disabled={isSubmitting}
                className="min-h-11"
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
