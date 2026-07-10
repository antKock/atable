'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { t } from '@/lib/i18n/fr'
import type { MembershipRole } from '@/lib/auth/owner-context'
import CodeDisplay from './CodeDisplay'
import InviteLinkDisplay from './InviteLinkDisplay'
import InlineEditableField from './InlineEditableField'
import LeaveHouseholdDialog from './LeaveHouseholdDialog'
import RolePill from './RolePill'

type Member = {
  ownerId: string
  displayName: string
  role: MembershipRole
  isViewer: boolean
}

type Props = {
  household: {
    id: string
    name: string
    joinCode: string
    isDemo: boolean
  }
  viewerRole: MembershipRole
  members: Member[]
}

// Détail d'un foyer (maquette 0.2b) : nom éditable inline, membres listés
// inline (chevron inerte à ce lot — l'action rôle-aware arrive au Lot 3),
// blocs d'invitation actuels (remplacés au Lot 3), quitter / supprimer.
export default function HouseholdDetailContent({ household, viewerRole, members }: Props) {
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
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-4">
      <Link
        href="/household"
        aria-label={t.a11y.backButton}
        className="mb-2 -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
      >
        <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
      </Link>

      {/* Nom du foyer, éditable inline (readOnly + badge si démo) */}
      <div className="mb-1 flex items-center gap-2">
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
      <p className="mb-6 text-sm text-muted-foreground">
        {t.household.rolesCap[viewerRole]} · {t.household.peopleCount(members.length)}
      </p>

      {/* Membres listés inline */}
      <section className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.household.membersSection}
        </p>
        <ul
          aria-label={t.household.membersSection}
          className="divide-y divide-border rounded-xl border border-border bg-surface"
        >
          {members.map((member) => (
            <li key={member.ownerId} className="flex min-h-12 items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
                {member.displayName}
                {member.isViewer && (
                  <span className="ml-1.5 text-muted-foreground">{t.household.youSuffix}</span>
                )}
              </span>
              <RolePill role={member.role} />
              {/* Chevron inerte à ce lot : l'action membre (rôle, retrait) arrive au Lot 3 */}
              <ChevronRight size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </li>
          ))}
        </ul>
      </section>

      {/* Blocs d'invitation (écran « Inviter » à 2 liens au Lot 3) */}
      <div className="mb-3">
        <CodeDisplay code={household.joinCode} />
      </div>
      <div className="mb-6">
        <InviteLinkDisplay joinCode={household.joinCode} />
      </div>

      {/* Quitter / supprimer (double confirmation, oblig. App Store) */}
      <LeaveHouseholdDialog householdId={household.id} />
    </div>
  )
}
