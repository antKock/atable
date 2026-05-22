import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { HouseholdCreateSchema } from '@/lib/schemas/household'
import { clearSessionCookie } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const hdrs = await headers()
  const householdId = hdrs.get('x-household-id')
  const { id } = await params

  if (!householdId || id !== householdId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = HouseholdCreateSchema.safeParse(body.name)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('households')
    .update({ name: parsed.data })
    .eq('id', householdId)
    .select('id, name')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to rename' }, { status: 500 })
  }

  revalidatePath('/household')
  return NextResponse.json({ id: data.id, name: data.name })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const hdrs = await headers()
  const householdId = hdrs.get('x-household-id')
  const sessionId = hdrs.get('x-session-id')
  const { id } = await params

  if (!householdId || !sessionId || id !== householdId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Explicit intent — the UI exposes two distinct actions:
  //   leave  → this device leaves; the household and its data are kept
  //   delete → the household and all its recipes/sessions are destroyed
  const action = request.nextUrl.searchParams.get('action')
  if (action !== 'leave' && action !== 'delete') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const supabase = createServerClient()

  if (action === 'delete') {
    // Explicitly delete all recipes first (recipes.household_id is ON DELETE SET NULL)
    const { error: recipesError } = await supabase
      .from('recipes')
      .delete()
      .eq('household_id', householdId)
    if (recipesError) {
      return NextResponse.json({ error: 'Failed to delete household data' }, { status: 500 })
    }
    // Delete household (CASCADE deletes device_sessions)
    const { error: householdError } = await supabase
      .from('households')
      .delete()
      .eq('id', householdId)
    if (householdError) {
      return NextResponse.json({ error: 'Failed to delete household' }, { status: 500 })
    }
  } else {
    // action === 'leave' — just remove this device's session
    const { error: sessionError } = await supabase
      .from('device_sessions')
      .delete()
      .eq('id', sessionId)
    if (sessionError) {
      return NextResponse.json({ error: 'Failed to leave household' }, { status: 500 })
    }
  }

  // Clear the cookie on a 200 JSON response (reliable in WKWebView); the
  // client reads `redirect` and navigates to the landing page itself.
  const response = NextResponse.json({ ok: true, redirect: '/' })
  clearSessionCookie(response)
  return response
}
