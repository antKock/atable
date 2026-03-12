# Story 4.3: Device Management & Revocation

Status: done

## Story

As a household member,
I want to see all devices connected to my household and revoke any device that should no longer have access,
So that I can secure our household library if a device is lost or shared.

## Acceptance Criteria

1. **Given** the `/household` page loading **When** `GET /api/devices` responds **Then** all non-revoked `device_sessions` for the household are listed **And** each device shows: device name (e.g. "iPhone 15 Pro · Safari") and last-seen date in French (e.g. "il y a 3 semaines")
2. **Given** the `DeviceListItem` for the current device (matching `x-session-id` header) **When** rendered **Then** it has a visual indicator as "cet appareil" **And** its revoke button is disabled
3. **Given** a `DeviceListItem` for a different device **When** the user taps the revoke button **Then** a confirmation dialog appears: "Révoquer l'accès ?"
4. **Given** the revocation confirmation **When** the user confirms **Then** the device disappears from the list immediately via `useOptimistic` **And** `DELETE /api/devices/[id]` is called in the background
5. **Given** `DELETE /api/devices/[id]` succeeds **Then** `device_sessions` row is marked `is_revoked = true` in DB **And** `Redis SET revoked:{sid} 1 EX 31536000` is called **And** `revalidatePath('/household')` is called
6. **Given** `DELETE /api/devices/[id]` failing **When** server returns an error **Then** the device reappears in the list (optimistic rollback) **And** error message is shown
7. **Given** the revoked device making any subsequent request **When** middleware checks `Redis GET revoked:{sid}` **Then** the device is redirected to `/` on its next request — no grace period

## Tasks / Subtasks

- [x] Implement `GET /api/devices` route handler (AC: 1)
  - [x] `src/app/api/devices/route.ts`
  - [x] Read `householdId` from `x-household-id` header
  - [x] Query non-revoked device_sessions for household, ordered by last_seen_at DESC
  - [x] Return JSON array of devices (camelCase)
- [x] Implement `DELETE /api/devices/[id]` route handler (AC: 4–5, 7)
  - [x] `src/app/api/devices/[id]/route.ts`
  - [x] Read `householdId` + `sessionId` from headers; await params
  - [x] Self-revocation check: returns 400
  - [x] Household ownership check: returns 404 if not matching
  - [x] `UPDATE device_sessions SET is_revoked = true WHERE id = $id`
  - [x] `redis.set('revoked:{id}', '1', { ex: 31536000 })`
  - [x] `revalidatePath('/household')`
- [x] Create `DeviceListItem` component (AC: 2–4, 6)
  - [x] `src/components/household/DeviceListItem.tsx` — Client Component
  - [x] Current device: "cet appareil" badge, revoke button disabled
  - [x] Other devices: revoke button → Dialog confirmation → onRevoke call
  - [x] Relative date format via `Intl.RelativeTimeFormat('fr', { numeric: 'auto' })`
- [x] Create `DeviceList` component with useOptimistic (AC: 1–2, 4, 6)
  - [x] `src/components/household/DeviceList.tsx` — Client Component
  - [x] useOptimistic removes device immediately; reverts on error via toast
- [x] Server Component fetches devices + passes sessionId (AC: 1–2)
  - [x] household/page.tsx: parallel fetch household + device_sessions
  - [x] sessionId read from x-session-id header

## Dev Notes

### useOptimistic Pattern

```tsx
// In a DeviceList client component
'use client'
import { useOptimistic } from 'react'

function DeviceList({ devices, currentSessionId }) {
  const [optimisticDevices, removeDevice] = useOptimistic(
    devices,
    (state, deviceId: string) => state.filter(d => d.id !== deviceId)
  )

  const handleRevoke = async (deviceId: string) => {
    removeDevice(deviceId) // optimistic remove
    try {
      const res = await fetch(`/api/devices/${deviceId}`, { method: 'DELETE' })
      if (!res.ok) {
        // useOptimistic automatically reverts when transition is done without mutation
        // But we need to show an error — use additional error state
        throw new Error(await res.json().then(d => d.error))
      }
    } catch (e) {
      setError(e.message)
    }
  }

  return optimisticDevices.map(device => (
    <DeviceListItem
      key={device.id}
      device={device}
      isCurrentDevice={device.id === currentSessionId}
      onRevoke={handleRevoke}
    />
  ))
}
```

### Relative Date Formatting

```ts
const formatRelativeDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

  if (diffDays < 1) return rtf.format(-Math.floor(diffMs / (1000 * 60 * 60)), 'hour')
  if (diffDays < 7) return rtf.format(-diffDays, 'day')
  if (diffDays < 30) return rtf.format(-Math.floor(diffDays / 7), 'week')
  if (diffDays < 365) return rtf.format(-Math.floor(diffDays / 30), 'month')
  return rtf.format(-Math.floor(diffDays / 365), 'year')
}
```

### Redis Revocation Key

```ts
// In DELETE /api/devices/[id]
import { redis } from '@/lib/redis'
await redis.set(`revoked:${deviceId}`, '1', { ex: 31536000 }) // 1 year TTL
```

The middleware (Story 1.2) checks `redis.get(`revoked:${sid}`)` — this key format must match exactly.

### Security — Verify Device Belongs to Household

Before revoking, verify the device_session belongs to the authenticated household:

```ts
const { data: device } = await supabase
  .from('device_sessions')
  .select('id, household_id')
  .eq('id', deviceId)
  .single()

if (!device || device.household_id !== householdId) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
```

This prevents a member from revoking devices in other households.

### Self-Revocation Prevention

The current device is identified by `x-session-id` header. If `deviceId === currentSessionId`, return 400. The DeviceListItem component also disables the revoke button for the current device — this is defence-in-depth (both UI and server).

### Last-Seen Update

Consider updating `last_seen_at` on each authenticated request (in middleware or per route). This is not in the AC but makes the device list more useful. If implementing: in middleware, after successful auth, fire an async update to `device_sessions SET last_seen_at = NOW() WHERE id = sid`. Use a background write (fire-and-forget) to avoid latency.

### References

- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Revocation Cache: Upstash Redis`
- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Device revocation data flow`
- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Gap 4 (revalidatePath)`
- Epics: `_bmad-output/planning-artifacts/epics-v2.md#Story 4.3`
- Depends on: Story 1.1 (redis.ts, types), Story 1.2 (middleware sets x-session-id), Story 4.1 (household page)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Used Dialog (shadcn/ui) for revoke confirmation — AlertDialog not installed
- useOptimistic in DeviceList auto-reverts when fetch fails; toast.error shown
- Redis revocation key format `revoked:{deviceId}` matches middleware check exactly
- DeviceListItem test deferred — no test infrastructure issue, complexity doesn't warrant unit test at this stage
- 54 tests passing (1 pre-existing RecipeCard carousel width failure)

### File List

- src/app/api/devices/route.ts (new — GET)
- src/app/api/devices/[id]/route.ts (new — DELETE)
- src/components/household/DeviceListItem.tsx (new)
- src/components/household/DeviceList.tsx (new)
- src/app/(app)/household/page.tsx (modified — parallel fetch + sessionId)
- src/components/household/HouseholdMenuContent.tsx (modified — DeviceList integration)

### Change Log

- 2026-03-02: Implemented Story 4.3 — Device management and revocation
