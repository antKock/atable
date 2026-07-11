import Link from 'next/link'
import { ChevronLeft, Users, Eye } from 'lucide-react'
import { t } from '@/lib/i18n/fr'
import CodeDisplay from './CodeDisplay'
import InviteLinkDisplay from './InviteLinkDisplay'

type Props = {
  householdId: string
  joinCode: string
  guestJoinCode: string
}

// Écran plein « Inviter » (maquette 2.1, Lot 3). Deux blocs de même grammaire
// (icône + rôle + description, puis lien + code + copier), un par rôle. La
// grammaire lien/code réutilise InviteLinkDisplay + CodeDisplay du Lot 1.
export default function InviteScreen({ householdId, joinCode, guestJoinCode }: Props) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-4">
      <Link
        href={`/household/${householdId}`}
        aria-label={t.a11y.backButton}
        className="mb-2 -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
      >
        <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-foreground">{t.household.invite.title}</h1>

      {/* Bloc Membre (lien membre = join_code) */}
      <section className="mb-6" aria-label={t.household.invite.memberBlockTitle}>
        <div className="mb-2 flex items-center gap-2">
          <Users size={18} strokeWidth={2} className="text-accent" aria-hidden="true" />
          <div>
            <p className="text-[15px] font-semibold text-foreground">
              {t.household.invite.memberBlockTitle}
            </p>
            <p className="text-sm text-muted-foreground">{t.household.invite.memberBlockDesc}</p>
          </div>
        </div>
        <div className="mb-3">
          <InviteLinkDisplay joinCode={joinCode} />
        </div>
        <CodeDisplay code={joinCode} />
      </section>

      {/* Bloc Invité (lien invité = guest_join_code) */}
      <section className="mb-6" aria-label={t.household.invite.guestBlockTitle}>
        <div className="mb-2 flex items-center gap-2">
          <Eye size={18} strokeWidth={2} className="text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-[15px] font-semibold text-foreground">
              {t.household.invite.guestBlockTitle}
            </p>
            <p className="text-sm text-muted-foreground">{t.household.invite.guestBlockDesc}</p>
          </div>
        </div>
        <div className="mb-3">
          <InviteLinkDisplay joinCode={guestJoinCode} />
        </div>
        <CodeDisplay code={guestJoinCode} />
      </section>

      <p className="text-sm text-muted-foreground">{t.household.invite.note}</p>
    </div>
  )
}
