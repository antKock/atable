import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const hdrs = await headers()
  const householdId = hdrs.get('x-household-id')

  if (!householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('device_sessions')
    .select('id, device_name, last_seen_at, created_at')
    .eq('household_id', householdId)
    .eq('is_revoked', false)
    .order('last_seen_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 })
  }

  const devices = (data ?? []).map((row) => ({
    id: row.id,
    deviceName: row.device_name,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  }))

  return NextResponse.json(devices)
}
