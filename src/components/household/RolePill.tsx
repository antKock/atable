import { Eye } from 'lucide-react'
import { t } from '@/lib/i18n/fr'
import type { MembershipRole } from '@/lib/auth/owner-context'

// Pill de rôle (chantier foyer) : membre = olive/accent, invité = neutre + œil.
// Posé au Lot 1, réutilisé aux Lots 3/4 (membres, invitations).
export default function RolePill({ role }: { role: MembershipRole }) {
  const isGuest = role === 'guest'
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold ${
        isGuest ? 'bg-foreground/5 text-muted-foreground' : 'bg-accent/10 text-accent'
      }`}
    >
      {isGuest && <Eye size={12} strokeWidth={2} aria-hidden="true" />}
      {t.household.roles[role]}
    </span>
  )
}
