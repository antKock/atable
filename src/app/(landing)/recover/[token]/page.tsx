import RecoverConsume from '@/components/auth/RecoverConsume'

type Props = {
  params: Promise<{ token: string }>
}

// Magic-link de récupération (#14) — route publique (middleware) + Universal
// Link (AASA /recover/* depuis le pré-lot). La page ne fait que déléguer au
// client : la consommation est un POST (single-use, pose le cookie).
export default async function RecoverPage({ params }: Props) {
  const { token } = await params
  return <RecoverConsume token={token} />
}
