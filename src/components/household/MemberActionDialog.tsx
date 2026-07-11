'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, UserCog } from 'lucide-react'
import { t } from '@/lib/i18n/fr'
import { haptics } from '@/lib/haptics'
import type { MembershipRole } from '@/lib/auth/owner-context'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type MemberTarget = {
  ownerId: string
  displayName: string
  role: MembershipRole
}

type Props = {
  householdId: string
  member: MemberTarget | null
  onClose: () => void
}

// Dialog rôle-aware (décision n°8 : dialog, pas de sheet) déclenché en tapant
// un membre sur le détail du foyer (Lot 3, maquette 2.2). Deux actions : basculer
// le rôle (membre ⇄ invité) et retirer du foyer. Les règles serveur (membre
// only, dernier membre, self, démo) sont dans l'API — ici on route les 4xx.
export default function MemberActionDialog({ householdId, member, onClose }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const close = () => {
    if (!isSubmitting) onClose()
  }

  async function changeRole(nextRole: MembershipRole) {
    if (!member) return
    setIsSubmitting(true)
    void haptics.light()
    try {
      const res = await fetch(`/api/households/${householdId}/members/${member.ownerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? t.household.memberAction.roleError)
      }
      onClose()
      router.refresh()
    } catch (err) {
      setIsSubmitting(false)
      toast.error(err instanceof Error ? err.message : t.household.memberAction.roleError, {
        duration: Infinity,
      })
    }
  }

  async function remove() {
    if (!member) return
    setIsSubmitting(true)
    void haptics.heavy()
    try {
      const res = await fetch(`/api/households/${householdId}/members/${member.ownerId}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? t.household.memberAction.removeError)
      }
      onClose()
      router.refresh()
    } catch (err) {
      setIsSubmitting(false)
      toast.error(err instanceof Error ? err.message : t.household.memberAction.removeError, {
        duration: Infinity,
      })
    }
  }

  const isGuest = member?.role === 'guest'

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && close()}>
      {member && (
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{member.displayName}</DialogTitle>
            <DialogDescription>
              {isGuest
                ? t.household.memberAction.subtitleGuest
                : t.household.memberAction.subtitleMember}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1">
            {/* Bascule de rôle */}
            <Button
              variant="ghost"
              type="button"
              disabled={isSubmitting}
              onClick={() => changeRole(isGuest ? 'member' : 'guest')}
              className="min-h-11 justify-start gap-2"
            >
              {isGuest ? (
                <UserCog size={18} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Eye size={18} strokeWidth={2} aria-hidden="true" />
              )}
              {isGuest
                ? t.household.memberAction.toMember
                : t.household.memberAction.toGuest}
            </Button>

            {/* Retrait (destructif) */}
            <Button
              variant="ghost"
              type="button"
              disabled={isSubmitting}
              onClick={remove}
              className="min-h-11 justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {t.household.memberAction.remove}
            </Button>
            <p className="px-3 text-xs text-muted-foreground">
              {t.household.memberAction.removeBody}
            </p>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
