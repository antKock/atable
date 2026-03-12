# Story 4.4: Leave Household

Status: done

## Story

As a household member,
I want to leave my household from the household menu,
So that I can disconnect this device from the shared library.

## Acceptance Criteria

1. **Given** the `/household` page **When** the user taps "Quitter le foyer" **Then** a confirmation dialog appears
2. **Given** the confirmation dialog when the user is NOT the last member **When** they confirm **Then** `DELETE /api/households/[id]` is called **And** session cookie is cleared via `clearSessionCookie` **And** user is redirected to `/`
3. **Given** the confirmation dialog when the user IS the last member **When** they view the dialog **Then** it explicitly warns that all household data (recipes, etc.) will be permanently deleted
4. **Given** the last-member deletion confirmed **When** `DELETE /api/households/[id]` runs **Then** all recipes belonging to the household are explicitly deleted first **And** the household row is then deleted (CASCADE deletes device_sessions) **And** session cookie is cleared **And** user is redirected to `/`
5. **Given** a successful leave (any member) **When** the user lands on `/` **Then** they see the landing screen and can create or join a new household

## Tasks / Subtasks

- [x] Add "Quitter le foyer" button to `HouseholdMenuContent` (AC: 1)
  - [x] LeaveHouseholdDialog component renders destructive-styled button
  - [x] On click: fetch device count then open confirmation dialog
- [x] Create `LeaveHouseholdDialog` component (AC: 1–3)
  - [x] `src/components/household/LeaveHouseholdDialog.tsx` — Client Component
  - [x] Fetches GET /api/devices when button clicked to determine isLastMember
  - [x] Not last member: "Quitter le foyer ?" with leaveBody + "Quitter" action
  - [x] Last member: "Supprimer le foyer ?" with leaveLastMemberBody + "Supprimer définitivement" action
  - [x] On error: toast.error, stay on page, do not clear cookie
- [x] Implement `DELETE /api/households/[id]` route handler (AC: 2, 4)
  - [x] In `src/app/api/households/[id]/route.ts` (same file as PUT)
  - [x] Validates id param matches x-household-id header
  - [x] Counts non-revoked sessions to determine last member
  - [x] Last member: DELETE recipes first (ON DELETE SET NULL — explicit required), then DELETE household
  - [x] Not last member: DELETE current device_session only
  - [x] clearSessionCookie + NextResponse.redirect('/') in all success paths

## Dev Notes

### Last Member Check

```ts
// In route handler or client pre-check:
const { count } = await supabase
  .from('device_sessions')
  .select('id', { count: 'exact', head: true })
  .eq('household_id', householdId)
  .eq('is_revoked', false)

const isLastMember = count === 1 // current device is the only non-revoked session
```

### Architecture — Leave vs Last-Member Behavior

| Scenario | Action |
|---|---|
| Not last member | DELETE current device_session → clear cookie → redirect `/` |
| Last member | DELETE all recipes → DELETE household (CASCADE: device_sessions) → clear cookie → redirect `/` |

Note: The explicit recipe deletion before household deletion is required by the AC. Even though `ON DELETE CASCADE` would eventually clean up if household had a CASCADE to recipes, the AC specifies an explicit delete first. Also, the cascade is `ON DELETE SET NULL` for recipes (per architecture), so explicit deletion is mandatory for last-member cleanup.

### Cookie Clear + Redirect Pattern

```ts
// In DELETE /api/households/[id]
const response = NextResponse.redirect(new URL('/', request.url))
clearSessionCookie(response)
return response
```

The `clearSessionCookie` function sets the cookie with `maxAge: 0` (or `expires` in the past) to clear it.

### V1 ConfirmDeleteDialog Pattern

V1 has a `ConfirmDeleteDialog` component (from Epic 5). Reuse or extend it for the leave household confirmation. It likely accepts title, description, and onConfirm props.

Check `src/components/recipes/` or `src/components/` for the existing dialog component.

### Client-Side Member Count Fetch

The "is last member" check can happen two ways:

**Option A (client-side before dialog shows):**
```ts
const handleLeaveClick = async () => {
  const res = await fetch('/api/devices') // GET /api/devices — get device list
  const devices = await res.json()
  setIsLastMember(devices.length === 1)
  setDialogOpen(true)
}
```

**Option B (server includes it in household page data):**
Include `deviceCount` in the server-fetched household data, pass to client.

Option A is simpler and avoids adding another prop to the household data chain.

### Accessibility — Destructive Action

- "Quitter le foyer" button: use `variant="destructive"` from shadcn/ui
- Dialog for last-member scenario: use alarming but clear language; avoid jargon
- "Supprimer définitivement" as the confirm CTA for last-member — this should feel irreversible
- `aria-describedby` pointing to the warning text in the dialog

### Error Handling

If `DELETE /api/households/[id]` fails:
- Do NOT redirect to `/`
- Do NOT clear the cookie
- Show an error in the UI: "Une erreur s'est produite. Veuillez réessayer."
- User remains on the `/household` page

### References

- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#New Route Handlers`
- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Conflict Point 1 (household ID from headers)`
- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Conflict Point 2 (session utility)`
- Epics: `_bmad-output/planning-artifacts/epics-v2.md#Story 4.4`
- Depends on: Story 1.1 (session.ts clearSessionCookie), Story 4.1 (HouseholdMenuContent, household page)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Used Dialog (not AlertDialog — not installed) matching ConfirmDeleteDialog pattern
- isLastMember determined client-side by calling GET /api/devices before opening dialog
- window.location.href = '/' used after DELETE (server redirects; fetch follows redirect naturally but window.location ensures full cookie clearing flush)
- DELETE route handles both last-member and non-last-member paths with explicit recipe cleanup
- 54 tests passing (1 pre-existing RecipeCard carousel width failure)

### File List

- src/components/household/LeaveHouseholdDialog.tsx (new)
- src/app/api/households/[id]/route.ts (modified — added DELETE)
- src/components/household/HouseholdMenuContent.tsx (modified — LeaveHouseholdDialog)
- src/lib/i18n/fr.ts (modified — lastMember strings)

### Change Log

- 2026-03-02: Implemented Story 4.4 — Leave household with last-member data deletion
