import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createServerClient } from '@/lib/supabase/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { createAppleConnectClient, credentialsFromEnv } from '@/lib/apple-connect/client'
import { syncAppStore } from '@/lib/apple-connect/sync'

// Rapatriement quotidien des stats App Store (backlog #19, migration 042).
// Même contrat que demo-reset : GET + `Authorization: Bearer $CRON_SECRET`,
// appelé par la crontab du VPS à 10:00 UTC (Apple publie J-1 dans la matinée —
// à 03:00 la veille n'est pas encore disponible). Moniteur Sentry Crons
// `app-store-sync` : alerte si le cron ne tourne pas ou dépasse 10 min.
//
// Variables : APPLE_CONNECT_KEY / _KEY_ID / _ISSUER_ID (clé Admin) et
// APPLE_CONNECT_APP_ID (id numérique de l'app). Sans elles : 503, pas d'alerte
// Sentry — le cron est simplement « non configuré » (staging sans clé).

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appId = process.env.APPLE_CONNECT_APP_ID
  if (!appId || !process.env.APPLE_CONNECT_KEY) {
    return NextResponse.json({ error: 'App Store Connect not configured' }, { status: 503 })
  }

  try {
    const summary = await Sentry.withMonitor(
      'app-store-sync',
      () =>
        syncAppStore({
          client: createAppleConnectClient(credentialsFromEnv()),
          supabase: createServerClient(),
          appId,
        }),
      {
        schedule: { type: 'crontab', value: '0 10 * * *' },
        checkinMargin: 30,
        maxRuntime: 10,
        timezone: 'UTC',
      },
    )
    return NextResponse.json(summary)
  } catch (err) {
    Sentry.captureException(err)
    console.error('[cron/app-store-sync] Sync failed:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
