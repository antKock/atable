import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
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

  // Fetch household name server-side (direct Supabase — no extra HTTP round-trip)
  const supabase = createServerClient()
  const { data: household } = await supabase
    .from('households')
    .select('id, name')
    .eq('join_code', code)
    .eq('is_demo', false)
    .single()

  if (!household) {
    return <ErrorState />
  }

  return <JoinConfirmation householdName={household.name} joinCode={code} />
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
