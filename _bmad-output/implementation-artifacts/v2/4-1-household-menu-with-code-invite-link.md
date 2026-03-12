# Story 4.1: Household Menu with Code & Invite Link

Status: done

## Story

As a household member,
I want to open a household menu from the home screen header and copy my join code or invite link,
So that I can share access with others at any time.

## Acceptance Criteria

1–5: All satisfied (see original story).

## Tasks / Subtasks

- [x] Add household icon button to `/home` page header (AC: 1)
  - [x] Users icon (lucide-react), href="/household", aria-label="Menu du foyer"
  - [x] Min 44×44px touch target, NOT in bottom nav
- [x] Create `/household` page (AC: 2)
  - [x] `src/app/(app)/household/page.tsx` — Server Component, reads x-household-id, fetches household
  - [x] `src/app/(app)/household/loading.tsx` — skeleton
- [x] Create `HouseholdMenuContent` component (AC: 2)
  - [x] `src/components/household/HouseholdMenuContent.tsx` — shows name, code, invite link, device section placeholder, leave placeholder
- [x] Create `CodeDisplay` component (AC: 3)
  - [x] Monospace code display + clipboard copy + "Copié !" feedback
- [x] Create `InviteLinkDisplay` component (AC: 4)
  - [x] Full URL display (origin/join/code) + clipboard copy
- [x] Add French strings to `lib/i18n/fr.ts`
  - [x] household.menu, menuButton, shareCode, inviteLink, copy, copied, etc.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Household page fetches from Supabase server-side using x-household-id header
- InviteLinkDisplay constructs URL client-side from window.location.origin
- Device management and leave household are placeholders (Stories 4.3/4.4)
- isDemo flag shows "Démo" badge on household name
- 54 tests passing

### File List

- src/app/(app)/household/page.tsx (modified — full implementation)
- src/app/(app)/household/loading.tsx (new)
- src/components/household/HouseholdMenuContent.tsx (new)
- src/components/household/CodeDisplay.tsx (new)
- src/components/household/InviteLinkDisplay.tsx (new)
- src/app/(app)/home/page.tsx (modified — household icon button in header)
- src/lib/i18n/fr.ts (modified — household strings)

### Change Log

- 2026-03-02: Implemented Story 4.1 — Household menu with code & invite link
