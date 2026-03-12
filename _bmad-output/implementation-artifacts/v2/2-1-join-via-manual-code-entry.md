# Story 2.1: Join via Manual Code Entry

Status: done

## Story

As a new household member who has received a join code,
I want to enter the code on the landing screen, preview the household name before confirming, and join with one tap,
So that I can join my household reliably even if the invite link didn't work.

## Acceptance Criteria

1. **Given** the landing screen **When** a user taps "Rejoindre un foyer" **Then** the `CodeEntryForm` is shown with a single join code input and placeholder indicating WORD-NNNN format
2. **Given** the `CodeEntryForm` input **When** entered text does not match `/^[A-Z]+-\d{4}$/` **Then** the submit/lookup action is not triggered (client-side format validation before network call)
3. **Given** a valid-format code **When** the user submits **Then** `GET /api/households/lookup?code=WORD-NNNN` is called
4. **Given** `GET /api/households/lookup` with a matching household **When** response arrives **Then** form displays: "Foyer *{name}* trouvé — Rejoindre ?" with a single confirm CTA
5. **Given** `GET /api/households/lookup` with no matching household **When** response arrives **Then** error message "Ce code ne correspond à aucun foyer" is shown
6. **Given** the household name preview shown **When** user taps confirm **Then** `POST /api/households/join` is called with the code
7. **Given** `POST /api/households/join` succeeds **When** response arrives **Then** `atable_session` cookie is set (httpOnly, secure, sameSite: lax, maxAge: 365d) **And** user is redirected to `/home` **And** a new `device_sessions` row exists for this device with human-readable device name
8. **Given** more than 5 requests from same IP within 1 hour to lookup or join **When** 6th request arrives **Then** 429 response with `{ error: 'Trop de tentatives, réessayez plus tard' }`
9. **Given** `CodeEntryForm` on mobile **When** rendered **Then** all interactive elements are ≥44×44px and form is keyboard navigable

## Tasks / Subtasks

- [x] Implement `GET /api/households/lookup` route handler (AC: 3–5, 8)
  - [x] `src/app/api/households/lookup/route.ts`
  - [x] Read `?code=` query param, validate against `JoinCodeSchema` from `lib/schemas/household.ts`
  - [x] Check rate limit via `joinRateLimit.limit(ip)` from `lib/redis.ts`
  - [x] On limit exceeded: return `{ status: 429, body: { error: 'Trop de tentatives, réessayez plus tard' } }`
  - [x] Query Supabase: `SELECT id, name FROM households WHERE join_code = $code AND is_demo = false`
  - [x] On match: return `{ householdId, householdName }`
  - [x] On no match: return `{ status: 404, body: { error: 'Ce code ne correspond à aucun foyer' } }`
  - [x] This is a PUBLIC route — no session check
- [x] Implement `POST /api/households/join` route handler (AC: 6–8)
  - [x] `src/app/api/households/join/route.ts`
  - [x] Read JSON body `{ code: string }`
  - [x] Validate code format via `JoinCodeSchema`
  - [x] Check rate limit (same `joinRateLimit` used by lookup)
  - [x] Query Supabase for household by join_code
  - [x] INSERT into `device_sessions` with device_name from `getDeviceName(ua)`
  - [x] Call `setSessionCookie(response, { hid, sid, iat })` from `lib/auth/session.ts`
  - [x] Redirect to `/home`
  - [x] This is a PUBLIC route — no session check
- [x] Create `CodeEntryForm` component (AC: 1–4, 9)
  - [x] `src/components/auth/CodeEntryForm.tsx` — Client Component
  - [x] Single join code input with placeholder "OLIVE-4821"
  - [x] Auto-uppercase input; format-validate on change against `/^[A-Z]+-\d{4}$/`
  - [x] On valid format: call `GET /api/households/lookup` automatically (or on blur/submit)
  - [x] Show loading state during lookup
  - [x] On success: show preview "Foyer *{name}* trouvé — Rejoindre ?" + confirm button
  - [x] On error: show "Ce code ne correspond à aucun foyer" inline
  - [x] On confirm tap: call `POST /api/households/join`, handle 429 error
  - [x] All buttons ≥44×44px; form keyboard navigable
- [x] Add French strings to `src/lib/i18n/fr.ts` (AC: 1, 4, 5, 8)
  - [x] `join.enterCode`, `join.placeholder`, `join.preview`, `join.confirm`
  - [x] `join.notFound`, `join.rateLimited`
- [x] Update landing screen to show CodeEntryForm when "Rejoindre un foyer" is tapped (AC: 1)
  - [x] In `LandingScreen.tsx`: toggle between main view and CodeEntryForm view

## Dev Notes

(see original story)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `GET /api/households/lookup`: validates JoinCodeSchema, rate limits by IP, returns householdId+householdName or 404/429
- `POST /api/households/join`: validates, rate limits, finds household, creates device_session, sets session cookie, redirects to /home
- `CodeEntryForm`: two-phase UI (code entry → auto-lookup → preview → confirm), auto-uppercase, inline errors
- `LandingScreen` updated to show `CodeEntryForm` on "Rejoindre un foyer" tap
- Added `join` strings section to fr.ts
- 54 tests passing

### File List

- src/app/api/households/lookup/route.ts (new)
- src/app/api/households/join/route.ts (new)
- src/components/auth/CodeEntryForm.tsx (new)
- src/components/auth/LandingScreen.tsx (modified — join view)
- src/lib/i18n/fr.ts (modified — join strings)

### Change Log

- 2026-03-02: Implemented Story 2.1 — Join via manual code entry
