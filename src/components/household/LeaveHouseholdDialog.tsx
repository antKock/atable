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

export default function LeaveHouseholdDialog({ householdId }: Props) {
  const [open, setOpen] = useState(false)
  const [isLastMember, setIsLastMember] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  const handleOpenDialog = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/devices')
      if (res.ok) {
        const devices = await res.json()
        setIsLastMember(devices.length === 1)
      } else {
        setIsLastMember(false)
      }
    } catch {
      setIsLastMember(false)
    } finally {
      setIsLoading(false)
      setOpen(true)
    }
  }

  const handleLeave = async () => {
    setIsLeaving(true)
    try {
      const res = await fetch(`/api/households/${householdId}`, { method: 'DELETE' })
      if (!res.ok) {
        throw new Error(t.household.leaveError)
      }
      // Server redirects to '/' — follow the redirect
      window.location.href = '/'
    } catch (err) {
      setOpen(false)
      setIsLeaving(false)
      toast.error(err instanceof Error ? err.message : t.household.leaveError, {
        duration: Infinity,
      })
    }
  }

  const title = isLastMember ? t.household.leaveLastMemberTitle : t.household.leaveConfirm
  const body = isLastMember ? t.household.leaveLastMemberBody : t.household.leaveBody
  const action = isLastMember ? t.household.leaveLastMemberAction : t.household.leaveAction

  return (
    <>
      <Button
        variant="ghost"
        type="button"
        disabled={isLoading}
        onClick={handleOpenDialog}
        className="min-h-[44px] text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {t.household.leaveHousehold}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLeaving}
              className="min-h-[44px]"
            >
              {t.actions.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleLeave}
              disabled={isLeaving}
              className="min-h-[44px]"
            >
              {action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
