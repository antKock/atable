# Story 3.2: Demo Exit Banner & Automated Reset

Status: done

## Story

As a demo user,
I want a persistent, unobtrusive exit option always visible, and to trust that demo data resets daily,
So that I can freely explore without commitment and convert cleanly to my own household when ready.

## Acceptance Criteria

1–7: All satisfied (see original story).

## Tasks / Subtasks

- [x] Create `DELETE /api/auth/session` route handler (AC: 2)
  - [x] `src/app/api/auth/session/route.ts`
  - [x] Calls `clearSessionCookie(response)`, redirects to `/`
  - [x] PUBLIC route
- [x] Create `POST /api/cron/demo-reset` route handler (AC: 4–7)
  - [x] `src/app/api/cron/demo-reset/route.ts`
  - [x] Validates `Authorization: Bearer {CRON_SECRET}` header — returns 401 if wrong
  - [x] Deletes non-seed demo recipes (WHERE is_seed = false AND household_id = DEMO_HOUSEHOLD_ID)
  - [x] Returns `{ reset: true, deleted: N, restored: 0 }`
  - [x] Wrapped in try/catch — logs errors, returns 500 on failure
- [x] Create `DemoBanner` component (AC: 1–3)
  - [x] `src/components/demo/DemoBanner.tsx` — Client Component
  - [x] Thin accent-colored banner at top of content
  - [x] "Quitter la démo" button calls DELETE /api/auth/session
- [x] Integrate DemoBanner into AppShell / (app) layout (AC: 1)
  - [x] `(app)/layout.tsx` reads `x-household-id` from headers, compares to DEMO_HOUSEHOLD_ID
  - [x] Renders `<DemoBanner />` only when isDemo=true — no extra DB query
- [x] Create `vercel.json` with Cron config (AC: 4)
  - [x] `{ "crons": [{ "path": "/api/cron/demo-reset", "schedule": "0 3 * * *" }] }`
- [x] Handle seed recipe tracking for reset (AC: 5)
  - [x] Migration `003_add_is_seed.sql`: ALTER TABLE recipes ADD COLUMN is_seed BOOLEAN NOT NULL DEFAULT false
  - [x] Updated `seed.sql` to include `is_seed = true` on all seed recipes
  - [x] Cron deletes WHERE is_seed = false (user-added) AND household_id = DEMO_HOUSEHOLD_ID

## Dev Notes

(see original story)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Used `is_seed` column approach (Option B) — requires migration 003
- Demo detection in AppShell: pure env comparison, no Supabase query
- DemoBanner is thin accent strip at top of content, not fixed position
- Cron reset only deletes non-seed recipes; seed recipes are preserved
- 54 tests passing

### File List

- supabase/migrations/003_add_is_seed.sql (new)
- supabase/seed.sql (modified — is_seed=true on all recipe inserts, column added)
- src/app/api/auth/session/route.ts (new)
- src/app/api/cron/demo-reset/route.ts (new)
- src/components/demo/DemoBanner.tsx (new)
- src/app/(app)/layout.tsx (modified — isDemo detection + DemoBanner)
- vercel.json (new)

### Change Log

- 2026-03-02: Implemented Story 3.2 — Demo exit banner + automated reset cron
