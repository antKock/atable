'use client'

import { useState } from 'react'
import { t } from '@/lib/i18n/fr'
import CodeDisplay from './CodeDisplay'
import InviteLinkDisplay from './InviteLinkDisplay'
import InlineEditableField from './InlineEditableField'
import DeviceList from './DeviceList'
import LeaveHouseholdDialog from './LeaveHouseholdDialog'

type DeviceSummary = {
  id: string
  deviceName: string
  lastSeenAt: string
}

type Household = {
  id: string
  name: string
  joinCode: string
  isDemo: boolean
}

type Props = {
  household: Household
  sessionId: string
  devices: DeviceSummary[]
}

export default function HouseholdMenuContent({ household, sessionId, devices }: Props) {
  const [name, setName] = useState(household.name)

  const handleRenameSave = async (newName: string) => {
    const previousName = name
    setName(newName) // optimistic update
    try {
      const res = await fetch(`/api/households/${household.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error(t.household.renameError)
    } catch (err) {
      setName(previousName) // revert on any failure
      throw err instanceof Error ? err : new Error(t.household.renameError)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">{t.household.menu}</h1>

      {/* Household name with inline rename */}
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.household.nameLabel}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <InlineEditableField
            value={name}
            onSave={handleRenameSave}
            readOnly={household.isDemo}
          />
          {household.isDemo && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              {t.household.demoLabel}
            </span>
          )}
        </div>
      </div>

      {/* Join code */}
      <div className="mb-3">
        <CodeDisplay code={household.joinCode} />
      </div>

      {/* Invite link */}
      <div className="mb-6">
        <InviteLinkDisplay joinCode={household.joinCode} />
      </div>

      {/* Device list */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.household.devices}
        </p>
        <DeviceList devices={devices} currentSessionId={sessionId} />
      </div>

      {/* Leave household */}
      <LeaveHouseholdDialog householdId={household.id} />
    </div>
  )
}
