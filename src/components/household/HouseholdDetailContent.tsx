'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Eye, UserPlus } from 'lucide-react'
import { t } from '@/lib/i18n/fr'
import type { MembershipRole } from '@/lib/auth/owner-context'
import InlineEditableField from './InlineEditableField'
import LeaveHouseholdDialog from './LeaveHouseholdDialog'
import RolePill from './RolePill'
import MemberActionDialog, { type MemberTarget } from './MemberActionDialog'

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

// Détail d'un foyer (maquette 0.2b / 2.2, Lot 3) : nom éditable inline (membre),
// membres groupés par rôle avec chevrons actifs pour un membre (dialog
// rôle-aware), entrée « Inviter », quitter / supprimer. Un invité voit un
// bandeau lecture seule, des chevrons inertes et seulement « Quitter ».
export default function HouseholdDetailContent({ household, viewerRole, members }: Props) {
  const [name, setName] = useState(household.name)
  const [selectedMember, setSelectedMember] = useState<MemberTarget | null>(null)

  const isMemberViewer = viewerRole === 'member'
  // Gestion des membres : réservée aux membres, jamais en démo (monde gelé).
  const canManage = isMemberViewer && !household.isDemo
  // Nom éditable et suppression du foyer : membres seulement.
  const readOnlyName = household.isDemo || !isMemberViewer

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

  const memberList = members.filter((m) => m.role === 'member')
  const guestList = members.filter((m) => m.role === 'guest')

  // Un chevron n'est actif que pour agir sur un AUTRE membre (pas soi-même :
  // se retirer = « Quitter »). Le serveur refuse de toute façon les actions self.
  const canActOn = (member: Member) => canManage && !member.isViewer

  const renderRow = (member: Member) => {
    const actionable = canActOn(member)
    const rowInner = (
      <>
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
          {member.displayName}
          {member.isViewer && (
            <span className="ml-1.5 text-muted-foreground">{t.household.youSuffix}</span>
          )}
        </span>
        <RolePill role={member.role} />
        <ChevronRight
          size={17}
          className={`shrink-0 ${actionable ? 'text-foreground' : 'text-muted-foreground'}`}
          aria-hidden="true"
        />
      </>
    )
    if (actionable) {
      return (
        <li key={member.ownerId}>
          <button
            type="button"
            onClick={() =>
              setSelectedMember({
                ownerId: member.ownerId,
                displayName: member.displayName,
                role: member.role,
              })
            }
            className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
          >
            {rowInner}
          </button>
        </li>
      )
    }
    return (
      <li key={member.ownerId} className="flex min-h-12 items-center gap-3 px-4 py-3">
        {rowInner}
      </li>
    )
  }

  const renderGroup = (label: string, list: Member[]) => {
    if (list.length === 0) return null
    return (
      <section className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <ul
          aria-label={label}
          className="divide-y divide-border rounded-xl border border-border bg-surface"
        >
          {list.map(renderRow)}
        </ul>
      </section>
    )
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

      {/* Nom du foyer, éditable inline (readOnly + badge si démo ou invité) */}
      <div className="mb-1 flex items-center gap-2">
        <InlineEditableField value={name} onSave={handleRenameSave} readOnly={readOnlyName} />
        {household.isDemo && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
            {t.household.demoLabel}
          </span>
        )}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        {t.household.rolesCap[viewerRole]} · {t.household.peopleCount(members.length)}
      </p>

      {/* Bandeau lecture seule pour un invité (maquette 2.x, Lot 3) */}
      {viewerRole === 'guest' && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-border bg-muted/50 px-4 py-3">
          <Eye size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t.household.guestReadOnly}</p>
        </div>
      )}

      {/* Membres puis invités (groupes affichés seulement s'ils existent) */}
      {renderGroup(t.household.membersSection, memberList)}
      {renderGroup(t.household.guestsSection, guestList)}

      {/* Entrée « Inviter quelqu'un » (membres, hors démo) — remplace les blocs
          code/lien du Lot 1, désormais dans l'écran plein /invite. */}
      {canManage && (
        <Link
          href={`/household/${household.id}/invite`}
          className="mb-6 flex min-h-12 items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-[15px] font-medium text-accent transition-colors hover:bg-accent/5"
        >
          <UserPlus size={18} strokeWidth={2} aria-hidden="true" />
          {t.household.inviteEntry}
        </Link>
      )}

      {/* Quitter / supprimer (suppression = membre only) */}
      <LeaveHouseholdDialog householdId={household.id} canDelete={isMemberViewer} />

      <MemberActionDialog
        householdId={household.id}
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
      />
    </div>
  )
}
