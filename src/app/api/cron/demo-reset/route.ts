import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createServerClient } from '@/lib/supabase/server'
import { isCronAuthorized } from '@/lib/cron-auth'

const DEFAULT_DEMO_SEED_MIN = 30

/**
 * Seuil d'alerte « démo amputée » : DEMO_SEED_MIN (30 en prod). Une valeur
 * illisible ou ≤ 0 désactiverait silencieusement l'alerte (`count < NaN` est
 * toujours faux) — on retombe sur 30 avec un warn.
 */
function demoSeedMin(): number {
  const raw = process.env.DEMO_SEED_MIN
  if (raw === undefined || raw === '') return DEFAULT_DEMO_SEED_MIN
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    console.warn(
      `[cron/demo-reset] DEMO_SEED_MIN invalide (« ${raw} ») — seuil ${DEFAULT_DEMO_SEED_MIN} appliqué`,
    )
    return DEFAULT_DEMO_SEED_MIN
  }
  return n
}

type ResetSummary = {
  reset: true
  deleted: number
  seedCount: number
  restored: number
  purgedTags: number
  purgedOwners: number
  purgedTokens: number
}

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

async function resetDemo(demoHouseholdIds: string[]): Promise<ResetSummary> {
  const supabase = createServerClient()

  // Step 0 (dashboard v2, migration 032) : consolider les agrégats quotidiens
  // AVANT toute purge — les recettes démo supprimées ci-dessous et les owners
  // purgés à 30 j sont la seule source de ces compteurs. Best-effort : un
  // échec du rollup ne doit pas empêcher le reset de la démo.
  // Un seul appel pour TOUS les foyers démo (migration 038 : variante uuid[]) —
  // l'upsert GREATEST de stats_daily ne sait pas additionner deux passages.
  const { error: rollupError } = await supabase.rpc('demo_stats_rollup', {
    p_demo_households: demoHouseholdIds,
    p_days: 30,
  })
  if (rollupError) {
    Sentry.captureException(
      new Error(`[cron/demo-reset] stats rollup failed: ${rollupError.message}`)
    )
  }

  // Step 1: Delete non-seed demo recipes (user-added during demo)
  const { count: deleted, error: deleteError } = await supabase
    .from('recipes')
    .delete({ count: 'exact' })
    .in('household_id', demoHouseholdIds)
    .eq('is_seed', false)

  if (deleteError) {
    console.error('[cron/demo-reset] Delete error:', deleteError.message)
    // Bloquant : levé pour que le moniteur Sentry passe en erreur (cf. GET).
    throw new Error(`[cron/demo-reset] delete failed: ${deleteError.message}`)
  }

  // Step 1b (incident 2026-09-04 : démo vidée par un visiteur, détectée par
  // hasard 3 jours plus tard) : compter les recettes seed restantes et
  // ALERTER (Sentry) si le foyer démo est amputé. Le seuil est le nombre de
  // seed attendu (DEMO_SEED_MIN, 30 en prod). Best-effort, n'empêche rien.
  const seedMin = demoSeedMin()
  let seedCount = 0
  for (const hid of demoHouseholdIds) {
    const { count, error: seedCountError } = await supabase
      .from('recipes')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', hid)
      .eq('is_seed', true)
    if (seedCountError) {
      Sentry.captureException(
        new Error(`[cron/demo-reset] seed count failed (${hid}): ${seedCountError.message}`)
      )
      continue
    }
    seedCount += count ?? 0
    if ((count ?? 0) < seedMin) {
      const msg = `[cron/demo-reset] ALERTE démo amputée (${hid}) : ${count ?? 0} recettes seed < ${seedMin} attendues — relancer scripts/restore-demo-from-staging.mjs (FR) ou scripts/demo-en/demo-en.mjs apply (EN)`
      console.error(msg)
      Sentry.captureException(new Error(msg), { level: 'fatal' })
    }
  }

  // Step 1c (monde gelé, revue 2026-09) : purger les tags custom rattachés aux
  // foyers démo — POST /api/tags refuse désormais la démo (403), ceci nettoie
  // l'existant et sert de filet. `recipe_tags` suit en cascade (FK
  // tag_id ON DELETE CASCADE, migration 004). Best-effort.
  let purgedTags = 0
  const { count: tagsCount, error: tagsError } = await supabase
    .from('tags')
    .delete({ count: 'exact' })
    .in('household_id', demoHouseholdIds)
  if (tagsError) {
    Sentry.captureException(
      new Error(`[cron/demo-reset] demo tags purge failed: ${tagsError.message}`)
    )
  } else {
    purgedTags = tagsCount ?? 0
  }

  // Step 2: Mark all seed recipes as not soft-deleted (restore visibility)
  // Seed recipes already exist with is_seed=true; nothing to restore unless deleted.
  // In this implementation, seed recipes are preserved (only non-seed are deleted).

  // Step 3 (stratégie C, part data — Lot 0 foyer) : purger les owners démo
  // plus vieux que N jours. La suppression d'un owner cascade memberships et
  // device_sessions ; daily_activity garde ses lignes (owner_id/device_id
  // SET NULL — la démo est de toute façon exclue des analytics).
  // Aucune rétention n'existait avant ce lot : N=30 j, marge large sur une
  // visite démo réelle sans laisser les identités jetables s'accumuler.
  const DEMO_OWNER_RETENTION_DAYS = 30
  const cutoff = new Date(
    Date.now() - DEMO_OWNER_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  let purgedOwners = 0
  const { data: demoMembers, error: demoMembersError } = await supabase
    .from('memberships')
    .select('owner_id, owners!inner(created_at)')
    .in('household_id', demoHouseholdIds)
    .lt('owners.created_at', cutoff)

  if (demoMembersError) {
    Sentry.captureException(
      new Error(`[cron/demo-reset] demo owners lookup failed: ${demoMembersError.message}`)
    )
  } else if (demoMembers && demoMembers.length > 0) {
    const candidateIds = demoMembers.map((m) => m.owner_id)

    // Garde-fou : ne JAMAIS toucher un owner ayant un membership hors démo.
    // Impossible en théorie avant le Lot 4 (multi-appartenance), mais un
    // faux positif ici détruirait le foyer réel d'un utilisateur.
    const { data: outside, error: outsideError } = await supabase
      .from('memberships')
      .select('owner_id')
      .in('owner_id', candidateIds)
      .not('household_id', 'in', `(${demoHouseholdIds.join(',')})`)

    if (outsideError) {
      Sentry.captureException(
        new Error(`[cron/demo-reset] non-demo membership check failed: ${outsideError.message}`)
      )
    } else {
      const protectedIds = new Set((outside ?? []).map((m) => m.owner_id))
      const toDelete = candidateIds.filter((id) => !protectedIds.has(id))
      if (toDelete.length > 0) {
        const { count, error: purgeError } = await supabase
          .from('owners')
          .delete({ count: 'exact' })
          .in('id', toDelete)
        if (purgeError) {
          Sentry.captureException(
            new Error(`[cron/demo-reset] owners purge failed: ${purgeError.message}`)
          )
        } else {
          purgedOwners = count ?? 0
        }
      }
    }
  }

  // Step 4 (#14, Lot 2) : purge des login_tokens morts — consommés ou
  // expirés depuis plus de 24 h (TTL réel : 15 min ; la marge laisse de quoi
  // inspecter un incident). Sans purge, la table croît indéfiniment : rien
  // d'autre ne supprime les tokens des owners réels.
  let purgedTokens = 0
  const tokenCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: tokensCount, error: tokensError } = await supabase
    .from('login_tokens')
    .delete({ count: 'exact' })
    .lt('expires_at', tokenCutoff)
  if (tokensError) {
    Sentry.captureException(
      new Error(`[cron/demo-reset] login_tokens purge failed: ${tokensError.message}`)
    )
  } else {
    purgedTokens = tokensCount ?? 0
  }

  // Step 5 (stats v3, 043) : purge des compteurs de consultation de plus de
  // 13 mois — best-effort, sans alerte bloquante.
  const { error: viewsError } = await supabase.rpc('purge_recipe_views', { p_keep_days: 400 })
  if (viewsError) {
    Sentry.captureException(new Error(`[cron/demo-reset] recipe_views purge failed: ${viewsError.message}`))
  }

  return {
    reset: true,
    deleted: deleted ?? 0,
    seedCount,
    restored: 0,
    purgedTags,
    purgedOwners,
    purgedTokens,
  }
}
