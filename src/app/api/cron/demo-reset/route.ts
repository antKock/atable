import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createServerClient } from '@/lib/supabase/server'

// Vercel Cron sends a GET request (not POST). Exporting GET ensures the
// scheduled job declared in vercel.json actually runs instead of 405-ing.
export async function GET(request: NextRequest) {
  // Authorization check — Vercel injects this header automatically on
  // scheduled invocations when CRON_SECRET is set in the project env.
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const demoHouseholdId = process.env.DEMO_HOUSEHOLD_ID
  if (!demoHouseholdId) {
    return NextResponse.json({ error: 'Demo not configured' }, { status: 503 })
  }

  const supabase = createServerClient()

  try {
    // Step 1: Delete non-seed demo recipes (user-added during demo)
    const { count: deleted, error: deleteError } = await supabase
      .from('recipes')
      .delete({ count: 'exact' })
      .eq('household_id', demoHouseholdId)
      .eq('is_seed', false)

    if (deleteError) {
      Sentry.captureException(new Error(`[cron/demo-reset] delete failed: ${deleteError.message}`))
      console.error('[cron/demo-reset] Delete error:', deleteError.message)
      return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
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
      .eq('household_id', demoHouseholdId)
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
        .neq('household_id', demoHouseholdId)

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

    return NextResponse.json({
      reset: true,
      deleted: deleted ?? 0,
      restored: 0,
      purgedOwners,
      purgedTokens,
    })
  } catch (err) {
    Sentry.captureException(err)
    console.error('[cron/demo-reset] Unexpected error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
