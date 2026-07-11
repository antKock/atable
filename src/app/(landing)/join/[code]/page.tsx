import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { resolveInviteCode } from '@/lib/auth/invite-code'
import { t } from '@/lib/i18n/fr'
import JoinConfirmation from '@/components/auth/JoinConfirmation'

const CODE_REGEX = /^[A-Z]+-\d{4}$/

type Props = {
  params: Promise<{ code: string }>
}

export default async function JoinPage({ params }: Props) {
  const { code } = await params

  // Validate format immediately — no DB call needed
  if (!CODE_REGEX.test(code)) {
    return <ErrorState />
  }

  // Résout le lien contre join_code OU guest_join_code (direct Supabase — pas
  // de round-trip HTTP) pour connaître le foyer ET le rôle porté par le code.
  const supabase = createServerClient()
  let invite
  try {
    invite = await resolveInviteCode(supabase, code)
  } catch (err) {
    // Une panne DB ne doit pas afficher « lien invalide » : error boundary, en
    // conservant le message d'origine pour le diagnostic (cf. household/[id]).
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`join page: résolution du code impossible (${message})`)
  }

  if (!invite) {
    return <ErrorState />
  }

  return (
    <JoinConfirmation
      householdName={invite.householdName}
      joinCode={code}
      role={invite.role}
    />
  )
}

function ErrorState() {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 px-6 text-center">
      <p className="text-base text-foreground">{t.joinLink.notFound}</p>
      <Link
        href="/"
        className="text-sm text-accent underline underline-offset-4 hover:opacity-80"
      >
        {t.joinLink.backToLanding}
      </Link>
    </div>
  )
}
