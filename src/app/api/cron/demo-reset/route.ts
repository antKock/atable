import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { isCronAuthorized } from '@/lib/cron-auth'
import { resetDemo } from '@/lib/demo/reset'

// Appelé en GET par la crontab du VPS (`/etc/cron.d/mijote-demo-reset`, posée
// par scripts/vps/bootstrap.sh) : `curl -H "Authorization: Bearer $CRON_SECRET"`.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const demoHouseholdId = process.env.DEMO_HOUSEHOLD_ID
  if (!demoHouseholdId) {
    return NextResponse.json({ error: 'Demo not configured' }, { status: 503 })
  }
  // Version EN (Lot 3) : second foyer démo, même traitement (purge, alerte
  // seed, owners) ; le rollup stats agrège les deux en un appel (038).
  const demoHouseholdIds = [demoHouseholdId, process.env.DEMO_HOUSEHOLD_ID_EN].filter(
    (id): id is string => Boolean(id),
  )

  // Moniteur Sentry (Crons) : un check-in par exécution ; Sentry alerte si le
  // cron ne se déclenche pas (03:00 UTC) ou dépasse 10 min — seule garantie
  // que la crontab du VPS tourne (docs/infra/migration-vps-ovh.md).
  // Un échec bloquant (delete des recettes) est LEVÉ depuis le callback : le
  // check-in passe en erreur (sinon le moniteur restait vert avec un 500), puis
  // le handler l'attrape et répond 500.
  try {
    const summary = await Sentry.withMonitor(
      'demo-reset',
      () => resetDemo(demoHouseholdIds),
      {
        schedule: { type: 'crontab', value: '0 3 * * *' },
        checkinMargin: 30,
        maxRuntime: 10,
        timezone: 'UTC',
      },
    )
    return NextResponse.json(summary)
  } catch (err) {
    Sentry.captureException(err)
    console.error('[cron/demo-reset] Reset failed:', err)
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
  }
}
