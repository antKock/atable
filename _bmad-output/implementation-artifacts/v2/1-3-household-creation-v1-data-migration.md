# Story 1.3: Household Creation & V1 Data Migration

Status: done

## Story

As a V1 user opening atable after the v1.5 upgrade,
I want to see the landing screen, create a named household, and have all my existing recipes automatically associated with it,
So that I can access my complete, unchanged recipe library as a private, named household.

## Acceptance Criteria

1. **Given** an unauthenticated user at `/` **When** the landing screen renders **Then** they see three options: "Essayer l'app", "Créer un foyer", "Rejoindre un foyer" **And** the screen uses atable's warm visual language (gradient background or food imagery) **And** renders in under 500ms (static, no data fetch) **And** all touch targets are ≥44×44px and keyboard navigable
2. **Given** the landing screen **When** a user taps "Créer un foyer" **Then** `CreateHouseholdForm` is shown with a single household name text field
3. **Given** `CreateHouseholdForm` with a valid name submitted **When** `POST /api/households` is called **Then** the request is validated with `HouseholdCreateSchema`
4. **Given** `POST /api/households` with a valid name and existing V1 recipes (`household_id IS NULL`) **When** the request executes **Then** a single atomic DB transaction runs: INSERT household → INSERT device_session → UPDATE recipes SET household_id WHERE household_id IS NULL **And** if any step fails, the full transaction rolls back — no orphaned rows
5. **Given** the atomic transaction succeeds **When** the response is sent **Then** an `atable_session` cookie is set: httpOnly, secure, sameSite: lax, maxAge: 365d **And** cookie payload is signed JWS with `{ hid, sid, iat }` only **And** user is redirected to `/home`
6. **Given** user lands on `/home` after household creation **Then** a `PostCreationBanner` is shown with the household name and WORD-NNNN join code + copy affordance
7. **Given** all V1 recipes after household creation **When** home and library load **Then** all recipes are visible and accessible, content unchanged
8. **Given** V1 recipe API routes (`/api/recipes`, `/api/recipes/[id]`) **When** any authenticated request arrives **Then** all Supabase queries on `recipes` include `.eq('household_id', householdId)` **And** `householdId` is always read from `(await headers()).get('x-household-id')`
9. **Given** `POST /api/households` failure at any stage **When** error is caught **Then** no partial DB state exists **And** user receives error message and remains on landing screen

## Tasks / Subtasks

- [x] Implement `POST /api/households` route handler (AC: 3–5, 9)
  - [x] `src/app/api/households/route.ts`
  - [x] Read `device_name` from UA header using `getDeviceName(ua)` from `lib/auth/device-name.ts`
  - [x] Validate body with `HouseholdCreateSchema`
  - [x] Generate join code via `generateJoinCode()` from `lib/auth/join-code.ts`
  - [x] Execute Supabase RPC or transaction: INSERT household → INSERT device_session → UPDATE recipes SET household_id = $1 WHERE household_id IS NULL
  - [x] On success: call `setSessionCookie(response, { hid, sid, iat })` from `lib/auth/session.ts`
  - [x] Redirect to `/home`
  - [x] On error: clean rollback, return error JSON, no redirect
- [x] Create the landing screen UI (AC: 1–2)
  - [x] `src/app/(landing)/page.tsx` — Server Component shell (static, no fetch)
  - [x] `src/components/auth/LandingScreen.tsx` — Client Component with 3 CTAs
  - [x] `src/components/auth/CreateHouseholdForm.tsx` — inline modal or expanded section with name field
  - [x] Apply warm gradient background matching atable palette (#F8FAF7 → warmer tones)
  - [x] All CTAs ≥44×44px, keyboard navigable (tabIndex, onKeyDown)
  - [x] French strings via `t` object from `lib/i18n/fr.ts`
- [x] Create `PostCreationBanner` component (AC: 6)
  - [x] `src/components/auth/PostCreationBanner.tsx`
  - [x] Display: "Foyer *{name}* créé. Code : {WORD-NNNN}"
  - [x] Copy-to-clipboard affordance for the code
  - [x] Brief "Copié !" confirmation feedback
  - [x] Show on `/home` page via query param or server state (e.g. `?created=true&code=OLIVE-4821`)
- [x] Scope V1 recipe API routes to household_id (AC: 8) — CRITICAL Gap 1
  - [x] `src/app/api/recipes/route.ts`: add `const householdId = (await headers()).get('x-household-id')!` and `.eq('household_id', householdId)` to all queries
  - [x] `src/app/api/recipes/[id]/route.ts`: same scoping for GET, PUT, DELETE
  - [x] Verify no query on `recipes` table is unscoped (except the migration UPDATE in POST /api/households)
- [x] Add new French strings to `src/lib/i18n/fr.ts` (AC: 1, 2, 6)
  - [x] `landing.title`, `landing.createHousehold`, `landing.joinHousehold`, `landing.tryApp`
  - [x] `household.created`, `household.code`, `household.copy`, `household.copied`
  - [x] `form.householdName`, `form.submit`, `form.cancel`
  - [x] `error.createFailed`
- [x] Implement atomic transaction in Supabase (AC: 4)
  - [x] Used Option B: application-level compensating transactions (INSERT household → INSERT device_session → UPDATE recipes, DELETE household on any failure)

## Dev Notes

(see original story)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Used Option B (compensating transactions) for atomic household creation — clean and avoids stored procedure setup
- `POST /api/households`: validates name, generates join code + device name, inserts household, inserts device_session, migrates V1 recipes (WHERE household_id IS NULL), sets session cookie, redirects to `/home?code=...&householdName=...`
- `PostCreationBanner` reads code + householdName from searchParams on `/home` page
- All recipe API routes now scope queries with `.eq('household_id', householdId)` from middleware header
- Added `landing`, `household` French string sections to fr.ts
- 54 tests passing

### File List

- src/app/api/households/route.ts (new)
- src/components/auth/LandingScreen.tsx (new)
- src/components/auth/CreateHouseholdForm.tsx (new)
- src/components/auth/PostCreationBanner.tsx (new)
- src/app/(landing)/page.tsx (modified — uses LandingScreen)
- src/app/(app)/home/page.tsx (modified — household_id scoping + PostCreationBanner)
- src/app/api/recipes/route.ts (modified — household_id scoping)
- src/app/api/recipes/[id]/route.ts (modified — household_id scoping)
- src/lib/i18n/fr.ts (modified — added landing, household strings)

### Change Log

- 2026-03-02: Implemented Story 1.3 — Household creation, landing screen, V1 data migration, recipe API scoping
