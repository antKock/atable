'use client'

import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'
import { t } from '@/lib/i18n/fr'
import type { DeviceSession } from '@/types/household'
import DeviceListItem from './DeviceListItem'

type DeviceSummary = Pick<DeviceSession, 'id' | 'deviceName' | 'lastSeenAt'>

type Props = {
  devices: DeviceSummary[]
  currentSessionId: string
}

export default function DeviceList({ devices, currentSessionId }: Props) {
  const [optimisticDevices, removeDevice] = useOptimistic(
    devices,
    (state: DeviceSummary[], deviceId: string) => state.filter((d) => d.id !== deviceId)
  )
  const [, startTransition] = useTransition()

  const handleRevoke = (deviceId: string) => {
    startTransition(async () => {
      removeDevice(deviceId)
      try {
        const res = await fetch(`/api/devices/${deviceId}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? t.household.revokeError)
        }
        toast.success(t.household.deviceRevoked, { duration: 2500 })
      } catch (err) {
        const msg = err instanceof Error ? err.message : t.household.revokeError
        toast.error(msg, { duration: Infinity })
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {optimisticDevices.map((device) => (
        <DeviceListItem
          key={device.id}
          device={device}
          isCurrentDevice={device.id === currentSessionId}
          onRevoke={handleRevoke}
        />
      ))}
    </div>
  )
}
