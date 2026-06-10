import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { JoinCodeSchema } from '@/lib/schemas/household'
import { joinRateLimit, joinCodeRateLimit } from '@/lib/redis'
import { t } from '@/lib/i18n/fr'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code') ?? ''

  const result = JoinCodeSchema.safeParse(code)
  if (!result.success) {
    return NextResponse.json({ error: 'Format de code invalide' }, { status: 400 })
  }

  // Rate limiting
  const hdrs = await headers()
  const ip = (hdrs.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
  const { success } = await joinRateLimit.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: t.join.rateLimited },
      { status: 429 }
    )
  }

  // Global per-code limit: stops a distributed brute-force that rotates IPs
  const { success: codeAllowed } = await joinCodeRateLimit.limit(result.data)
  if (!codeAllowed) {
    return NextResponse.json(
      { error: t.join.rateLimited },
      { status: 429 }
    )
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('households')
    .select('id, name')
    .eq('join_code', result.data)
    .eq('is_demo', false)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Ce code ne correspond à aucun foyer' },
      { status: 404 }
    )
  }

  return NextResponse.json({ householdId: data.id, householdName: data.name })
}
