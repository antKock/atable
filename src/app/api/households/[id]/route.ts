import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { HouseholdCreateSchema } from '@/lib/schemas/household'
import { clearSessionCookie } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { withHouseholdAuth } from '@/lib/api/with-household-auth'
import { withOwnerAuth } from '@/lib/api/with-owner-auth'

type RouteContext = { params: Promise<{ id: string }> }

export const PUT = withHouseholdAuth(
  async (request: NextRequest, { params }: RouteContext, { householdId }) => {
    const { id } = await params

    if (id !== householdId) {
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
  },
)

export const DELETE = withOwnerAuth(
  async (request: NextRequest, { params }: RouteContext, owner) => {
    const { id } = await params

    // Invariant mono-foyer (vrai jusqu'au Lot 4) : le foyer de la session est
    // l'unique membership de l'owner.
    const householdId = owner.memberships[0]?.householdId
    const { ownerId, sessionId } = owner

    if (!householdId || id !== householdId) {
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
      // The demo household is shared sample content, not a user's own data — a
      // demo session must not be able to destroy it for everyone (which has
      // happened: the whole demo was wiped this way). 'leave' still works, so
      // Apple 5.1.1(v) — delete *your* data — stays satisfied.
      const { data: hh } = await supabase
        .from('households')
        .select('is_demo')
        .eq('id', householdId)
        .single()
      if (hh?.is_demo) {
        return NextResponse.json(
          { error: 'Le foyer démo ne peut pas être supprimé.' },
          { status: 403 },
        )
      }

      // Purge Storage files first — the DB row delete cascade won't reach them.
      // Apple 5.1.1(v) requires effective server-side data deletion.
      const { data: recipesToDelete } = await supabase
        .from('recipes')
        .select('photo_url, generated_image_url')
        .eq('household_id', householdId)
      if (recipesToDelete && recipesToDelete.length > 0) {
        const paths: string[] = []
        for (const r of recipesToDelete) {
          for (const url of [r.photo_url, r.generated_image_url]) {
            if (url) {
              const match = (url as string).match(/recipe-photos\/(.+)$/)
              if (match) paths.push(match[1])
            }
          }
        }
        if (paths.length > 0) {
          await supabase.storage.from('recipe-photos').remove(paths)
        }
      }
      // Delete household — since migration 027 the CASCADE reaches recipes,
      // memberships and device_sessions (owner rows of other devices remain:
      // an owner is an identity, not an access).
      const { error: householdError } = await supabase
        .from('households')
        .delete()
        .eq('id', householdId)
      if (householdError) {
        return NextResponse.json({ error: 'Failed to delete household' }, { status: 500 })
      }
    } else {
      // action === 'leave' — drop the owner's membership, then this device's
      // session. Membership first: if the session delete fails the user is
      // still a member and can retry; the reverse would leave an unreachable
      // membership behind.
      const { error: membershipError } = await supabase
        .from('memberships')
        .delete()
        .eq('owner_id', ownerId)
        .eq('household_id', householdId)
      if (membershipError) {
        return NextResponse.json({ error: 'Failed to leave household' }, { status: 500 })
      }
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
  },
)
