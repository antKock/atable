# Story 2.2: Join via Invite Link

Status: done

## Story

As a new household member receiving an invite link via iMessage, SMS, or WhatsApp on iOS,
I want to tap the link, see the household name pre-identified, and join with a single confirmation tap,
So that I can join the shared library in seconds without typing anything.

## Acceptance Criteria

1–6: All satisfied (see original story).

## Tasks / Subtasks

- [x] Create `/join/[code]` page (AC: 1–2, 5)
  - [x] `src/app/(landing)/join/[code]/page.tsx` — Server Component
  - [x] Use `await params` to get code (Next.js 16 async params pattern)
  - [x] Validate code format: if invalid regex, render error state immediately
  - [x] Fetch household name server-side: direct Supabase query
  - [x] On valid household: render `JoinConfirmation` client component with household name pre-populated
  - [x] On invalid/not-found: render error state with link back to `/`
- [x] Create `JoinConfirmation` component (AC: 2, 4)
  - [x] `src/components/auth/JoinConfirmation.tsx` — Client Component
  - [x] Props: `{ householdName: string; joinCode: string }`
  - [x] Hero text: "Rejoindre *{name}* ?" — prominent name
  - [x] Single confirm CTA: "Rejoindre" button (≥44×44px, full-width)
  - [x] On tap: POST to `/api/households/join` with the code
  - [x] On success: browser follows redirect to `/home`
  - [x] On error: show inline error message
- [x] Verify middleware correctly passes `/join/` routes (AC: 3, 6)
  - [x] `PUBLIC_PREFIXES` in `middleware.ts` already includes `'/join/'` (Story 1.2)
- [x] Add French strings (AC: 2, 5)
  - [x] `joinLink.hero`, `joinLink.confirm`, `joinLink.notFound`, `joinLink.backToLanding`

## Dev Notes

(see original story)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Server-side household fetch using direct Supabase query (Option A — avoids extra HTTP round-trip)
- `JoinConfirmation` uses same `POST /api/households/join` as CodeEntryForm
- ErrorState rendered inline for invalid format or not-found household
- middleware.ts PUBLIC_PREFIXES already covers `/join/` from Story 1.2
- 54 tests passing

### File List

- src/app/(landing)/join/[code]/page.tsx (new)
- src/components/auth/JoinConfirmation.tsx (new)
- src/lib/i18n/fr.ts (modified — joinLink strings)

### Change Log

- 2026-03-02: Implemented Story 2.2 — Join via invite link
