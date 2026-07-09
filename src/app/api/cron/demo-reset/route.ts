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

    return NextResponse.json({
      reset: true,
      deleted: deleted ?? 0,
      restored: 0,
    })
  } catch (err) {
    Sentry.captureException(err)
    console.error('[cron/demo-reset] Unexpected error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
