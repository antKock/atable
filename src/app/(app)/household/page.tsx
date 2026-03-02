import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import HouseholdMenuContent from '@/components/household/HouseholdMenuContent'

export default async function HouseholdPage() {
  const hdrs = await headers()
  const householdId = hdrs.get('x-household-id')
  const sessionId = hdrs.get('x-session-id')
  if (!householdId || !sessionId) redirect('/')

  const supabase = createServerClient()

  const [{ data: household }, { data: deviceRows }] = await Promise.all([
    supabase
      .from('households')
      .select('id, name, join_code, is_demo')
      .eq('id', householdId)
      .single(),
    supabase
      .from('device_sessions')
      .select('id, device_name, last_seen_at')
      .eq('household_id', householdId)
      .eq('is_revoked', false)
      .order('last_seen_at', { ascending: false }),
  ])

  if (!household) redirect('/')

  const devices = (deviceRows ?? []).map((row) => ({
    id: row.id,
    deviceName: row.device_name,
    lastSeenAt: row.last_seen_at,
  }))

  return (
    <HouseholdMenuContent
      household={{
        id: household.id,
        name: household.name,
        joinCode: household.join_code,
        isDemo: household.is_demo,
      }}
      sessionId={sessionId}
      devices={devices}
    />
  )
}
