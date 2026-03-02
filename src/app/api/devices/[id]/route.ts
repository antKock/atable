import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { redis } from '@/lib/redis'
import { revalidatePath } from 'next/cache'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const hdrs = await headers()
  const householdId = hdrs.get('x-household-id')
  const sessionId = hdrs.get('x-session-id')
  const { id: deviceId } = await params

  if (!householdId || !sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Prevent self-revocation
  if (deviceId === sessionId) {
    return NextResponse.json(
      { error: 'Vous ne pouvez pas révoquer votre propre appareil' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // Verify device belongs to this household
  const { data: device } = await supabase
    .from('device_sessions')
    .select('id, household_id')
    .eq('id', deviceId)
    .single()

  if (!device || device.household_id !== householdId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Mark as revoked in DB
  const { error: updateError } = await supabase
    .from('device_sessions')
    .update({ is_revoked: true })
    .eq('id', deviceId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to revoke device' }, { status: 500 })
  }

  // Add to Redis revocation cache (1-year TTL)
  await redis.set(`revoked:${deviceId}`, '1', { ex: 31536000 })

  revalidatePath('/household')
  return NextResponse.json({ ok: true })
}
