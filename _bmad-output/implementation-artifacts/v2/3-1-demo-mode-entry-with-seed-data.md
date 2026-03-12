# Story 3.1: Demo Mode Entry with Seed Data

Status: done

## Story

As a first-time visitor who wants to try atable without commitment,
I want to tap "Essayer l'app" and immediately enter a fully-stocked recipe library,
So that I can experience the full app before deciding to create my own household.

## Acceptance Criteria

1–5: All satisfied (see original story).

## Tasks / Subtasks

- [x] Create `supabase/seed.sql` with demo household + seed recipes (AC: 3)
  - [x] INSERT INTO households with DEMO_HOUSEHOLD_ID (`00000000-0000-0000-0000-000000000000`), is_demo=true, join_code='DEMO-0000'
  - [x] INSERT 10 realistic French recipes: Tarte aux pommes, Ratatouille, Bœuf bourguignon, Crème brûlée, Quiche lorraine, Soupe à l'oignon, Salade niçoise, Coq au vin, Madeleines, Croissants maison
  - [x] Mix of TheMealDB photos and null (gradient fallback)
- [x] Implement `POST /api/demo/session` route handler (AC: 1–2, 5)
  - [x] `src/app/api/demo/session/route.ts`
  - [x] Reads DEMO_HOUSEHOLD_ID from env, inserts device_session, sets session cookie, redirects to /home
  - [x] PUBLIC route — no session required
- [x] Update landing screen "Essayer l'app" CTA (AC: 1)
  - [x] Button now POSTs to `/api/demo/session` with loading state
- [x] Add `DEMO_HOUSEHOLD_ID` docs to `.env.example` (AC: 3)
- [x] Verify V1 features work in demo mode (AC: 4)
  - [x] All recipe routes use household_id from middleware header — demo session works identically

## Dev Notes

(see original story)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- DEMO_HOUSEHOLD_ID = `00000000-0000-0000-0000-000000000000` (deterministic, used in seed.sql)
- seed.sql uses ON CONFLICT DO NOTHING for idempotent re-runs
- Demo session cookie identical to real session — middleware treats equally
- 54 tests passing

### File List

- supabase/seed.sql (new)
- src/app/api/demo/session/route.ts (new)
- src/components/auth/LandingScreen.tsx (modified — demo button POSTs)
- .env.example (modified — DEMO_HOUSEHOLD_ID docs)

### Change Log

- 2026-03-02: Implemented Story 3.1 — Demo mode entry + seed data
