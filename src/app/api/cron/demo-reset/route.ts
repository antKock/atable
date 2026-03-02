import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // Authorization check
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
      console.error('[cron/demo-reset] Delete error:', deleteError.message)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
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
    console.error('[cron/demo-reset] Unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
