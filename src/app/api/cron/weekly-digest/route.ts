import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createServerClient } from '@/lib/supabase/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { getDashboardV3 } from '@/lib/admin/v3/data'
import { renderDigest } from '@/lib/admin/v3/digest'
import { addDays, isoWeekLabel, lastSunday, shortDate } from '@/lib/admin/v3/weeks'

// Digest hebdo du dashboard (stats v3 §4.9) : le bloc 1 en texte, envoyé le
// lundi à DIGEST_TO via Resend. Même contrat que les autres crons (GET +
// Bearer CRON_SECRET, crontab VPS à 07:00 Paris). Idempotent par semaine ISO
// close (table digests_sent) : un passage manuel en plus ne renvoie rien, un
// lundi manqué se rattrape le lendemain. Sans DIGEST_TO ou sans RESEND_API_KEY
// (staging) : 503, pas d'alerte. Pas de moniteur Sentry Crons (un seul seat) :
// un échec part en captureException.

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const to = process.env.DIGEST_TO
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!to || !apiKey || !from) {
    return NextResponse.json({ error: 'Digest not configured (DIGEST_TO, RESEND_API_KEY, EMAIL_FROM)' }, { status: 503 })
  }

  try {
    const now = new Date()
    const sunday = lastSunday(now)
    const week = isoWeekLabel(sunday)
    const supabase = createServerClient()

    const { data: already, error: readError } = await supabase.from('digests_sent').select('week').eq('week', week).maybeSingle()
    if (readError) throw new Error(`digests_sent: ${readError.message}`)
    if (already) return NextResponse.json({ sent: false, week, reason: 'already sent' })

    const { data } = await getDashboardV3(now)
    const statsUrl = `${(process.env.APP_ORIGIN ?? 'https://mijote.anthonykocken.fr').replace(/\/$/, '')}/admin/stats`
    const digest = renderDigest(data.overview, {
      weekLabel: `semaine du ${shortDate(addDays(sunday, -6))} au ${shortDate(sunday)} (${week})`,
      statsUrl,
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: digest.subject, html: digest.html, text: digest.text }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`digest: envoi Resend échoué (HTTP ${res.status}) ${detail}`.trim())
    }

    const { error: markError } = await supabase.from('digests_sent').insert({ week, sent_to: to })
    if (markError) throw new Error(`digests_sent insert: ${markError.message}`)

    return NextResponse.json({ sent: true, week, to, subject: digest.subject })
  } catch (err) {
    Sentry.captureException(err)
    console.error('[cron/weekly-digest] failed:', err)
    return NextResponse.json({ error: 'Digest failed' }, { status: 500 })
  }
}
