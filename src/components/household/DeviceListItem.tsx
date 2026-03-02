'use client'

import { useState } from 'react'
import { t } from '@/lib/i18n/fr'
import type { DeviceSession } from '@/types/household'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

  if (diffDays < 1) return rtf.format(-Math.floor(diffMs / (1000 * 60 * 60)), 'hour')
  if (diffDays < 7) return rtf.format(-diffDays, 'day')
  if (diffDays < 30) return rtf.format(-Math.floor(diffDays / 7), 'week')
  if (diffDays < 365) return rtf.format(-Math.floor(diffDays / 30), 'month')
  return rtf.format(-Math.floor(diffDays / 365), 'year')
}

type Props = {
  device: Pick<DeviceSession, 'id' | 'deviceName' | 'lastSeenAt'>
  isCurrentDevice: boolean
  onRevoke: (id: string) => void
}

export default function DeviceListItem({ device, isCurrentDevice, onRevoke }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{device.deviceName}</p>
        <p className="text-sm text-muted-foreground">{formatRelativeDate(device.lastSeenAt)}</p>
      </div>

      {isCurrentDevice ? (
        <span className="ml-3 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
          {t.household.currentDevice}
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-3 text-sm text-destructive underline-offset-4 hover:underline"
          >
            {t.household.revokeDevice}
          </button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>{t.household.revokeDeviceConfirm}</DialogTitle>
                <DialogDescription>{t.household.revokeBody}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="min-h-[44px]"
                >
                  {t.actions.cancel}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setOpen(false)
                    onRevoke(device.id)
                  }}
                  className="min-h-[44px]"
                >
                  {t.household.revokeDevice}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
