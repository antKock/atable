# Story 1.2: Authentication Middleware Gate

Status: done

## Story

As a household member,
I want the application to validate my session on every page load and redirect me to the landing screen if I'm not authenticated,
So that the recipe library is private to my household and inaccessible without a valid session.

## Acceptance Criteria

1. **Given** an unauthenticated user (no `atable_session` cookie) **When** they navigate to any route except `/` and `/join/[code]` **Then** they are redirected to `/`
2. **Given** an authenticated user with a valid `atable_session` cookie **When** they navigate to `/` **Then** they are redirected to `/home`
3. **Given** a valid `atable_session` cookie arriving in middleware **When** middleware validates it **Then** the JWS signature is verified via `lib/auth/session.ts` (no DB call) **And** Redis `GET revoked:{sid}` is checked **And** `x-household-id` and `x-session-id` request headers are set on the forwarded request **And** total middleware overhead is under 10ms
4. **Given** a revoked session (Redis key `revoked:{sid}` exists) **When** the revoked device makes any authenticated request **Then** they are redirected to `/` **And** no recipe data is exposed
5. **Given** `PUBLIC_ROUTES` constant in `middleware.ts` **When** a request arrives for `/` or `/join/[code]` **Then** it passes through without session validation
6. **Given** any session validation failure (malformed token, expired signature, missing cookie) **When** the failure is caught **Then** the user is redirected to `/` — never a 5xx error, never a broken state
7. **Given** the `(landing)/` route group **When** rendered **Then** it uses `LandingLayout` with no navigation bar and gradient background
8. **Given** the `(app)/` route group **When** any authenticated route is rendered **Then** it uses `AppShell` with the navigation bar (moved from root layout) **And** the home URL within the app is `/home`, not `/`
9. **Given** the `Navigation` component **When** rendered **Then** the home icon/link points to `href="/home"` (not `"/"`)

## Tasks / Subtasks

- [x] Replace V1 `middleware.ts` with full auth gate (AC: 1–6)
  - [x] Define `PUBLIC_ROUTES = ['/', '/join']` (and prefix-match `/join/`)
  - [x] For public routes: pass through without validation
  - [x] For all other routes: call `verifySession(token)` from `lib/auth/session.ts`
  - [x] On valid session: Redis `GET revoked:{sid}` — redirect to `/` if revoked
  - [x] On valid non-revoked session: set `x-household-id` and `x-session-id` request headers, forward request
  - [x] On authenticated user visiting `/`: redirect to `/home` (AC: 2)
  - [x] All failures (malformed, expired, missing): redirect to `/` — never throw, never 5xx
  - [x] Add `export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'] }`
- [x] Restructure app route groups (AC: 7–8)
  - [x] Create `src/app/(landing)/layout.tsx` — LandingLayout wrapper (gradient bg, no nav, no AppShell)
  - [x] Create `src/app/(landing)/page.tsx` placeholder (minimal, Story 1.3 fills it out)
  - [x] Create `src/app/(app)/layout.tsx` — move AppShell (with nav) here from root `layout.tsx`
  - [x] Create `src/app/(app)/home/` directory; move content from `src/app/page.tsx`
  - [x] Update root `src/app/layout.tsx` — remove AppShell, keep only html/body shell + globals
  - [x] Move `src/app/loading.tsx` → `src/app/(app)/home/loading.tsx`
  - [x] Move `src/app/library/` → `src/app/(app)/library/`
  - [x] Move `src/app/recipes/` → `src/app/(app)/recipes/`
  - [x] Create `src/app/(app)/household/` directory placeholder for Story 4.1
- [x] Fix Navigation home link (AC: 9)
  - [x] In `src/components/layout/Navigation.tsx`: change home href from `"/"` to `"/home"`
- [x] Verify all existing links/redirects using `/` as home are updated to `/home`

## Dev Notes

### CRITICAL: Middleware Must Run on Edge Runtime

`middleware.ts` must be Edge Runtime compatible:
- `lib/auth/session.ts` uses `jose` (Web Crypto — Edge compatible ✅)
- `lib/redis.ts` uses Upstash `@upstash/ratelimit` REST API (Edge compatible ✅)
- **Do NOT import any Node.js-only modules** (`fs`, `crypto`, `path`, etc.) into middleware

### Middleware Pattern

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { redis } from '@/lib/redis'

const PUBLIC_ROUTES = ['/']
const PUBLIC_PREFIXES = ['/join/']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))

  const token = request.cookies.get('atable_session')?.value
  const payload = token ? await verifySession(token) : null

  // Authenticated user visiting landing → redirect to /home
  if (pathname === '/' && payload) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  if (!isPublic) {
    if (!payload) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    // Check revocation
    const isRevoked = await redis.get(`revoked:${payload.sid}`)
    if (isRevoked) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    // Forward household context via headers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-household-id', payload.hid)
    requestHeaders.set('x-session-id', payload.sid)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
```

### Route Group Migration Map

| Before (V1) | After (V1.5) |
|---|---|
| `src/app/page.tsx` (was home) | `src/app/(app)/home/page.tsx` |
| `src/app/(home)/page.tsx` | `src/app/(app)/home/page.tsx` |
| `src/app/(home)/loading.tsx` | `src/app/(app)/home/loading.tsx` |
| `src/app/library/page.tsx` | `src/app/(app)/library/page.tsx` |
| `src/app/recipes/**` | `src/app/(app)/recipes/**` |
| `src/app/layout.tsx` | Keep as root HTML shell only |
| NEW: `src/app/(landing)/page.tsx` | Landing screen |
| NEW: `src/app/(landing)/join/[code]/page.tsx` | Invite link |
| NEW: `src/app/(app)/household/page.tsx` | Household menu |

**Note:** The V1 `src/app/(home)/` directory (if it exists as a route group wrapper) collapses into `(app)/home/`. Check V1 structure carefully before moving.

### Header Propagation — CRITICAL Rule

All authenticated Server Components and Route Handlers read the household ID from request headers:

```ts
// ✅ CORRECT — always use this pattern
import { headers } from 'next/headers'
const householdId = (await headers()).get('x-household-id')!

// ❌ NEVER re-parse the cookie in a Route Handler
```

Middleware sets both `x-household-id` and `x-session-id` on every authenticated request. Route Handlers and Server Components rely on these — never parse the cookie directly.

### LandingLayout Requirements

- No nav bar (BottomNav / SideRail)
- Gradient background (warm palette — `#F8FAF7` to warmer tones or food imagery)
- Full-screen layout, centered content
- See Story 1.3 for the full landing screen component

### AppShell Move

In V1, `AppShell` with navigation is in root `layout.tsx`. In V1.5:
- Root `layout.tsx` → only `<html lang="fr"><body>...</body></html>` + global CSS
- `(app)/layout.tsx` → AppShell with Navigation (applies to all app routes)
- `(landing)/layout.tsx` → LandingLayout (applies to landing + join routes)

Check `src/app/layout.tsx` and `src/components/layout/` before moving AppShell.

### Public API Routes

These API routes are NOT protected by middleware session check (add to PUBLIC_ROUTES/PUBLIC_PREFIXES or handle via matcher):
- `POST /api/households` — create household
- `GET /api/households/lookup` — code lookup
- `POST /api/households/join` — join by code
- `POST /api/demo/session` — demo entry
- `DELETE /api/auth/session` — clear cookie (always public)
- `POST /api/cron/demo-reset` — uses CRON_SECRET, not session

The matcher config ensures `/api/` routes go through middleware. Use header-based check in middleware or prefix-match to skip auth check for the above public API routes.

### References

- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Authentication & Security`
- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Frontend Architecture`
- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Conflict Point 1`
- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Conflict Point 4`
- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Gap 2`
- Epics: `_bmad-output/planning-artifacts/epics-v2.md#Story 1.2`
- Depends on: Story 1.1 (lib/auth/session.ts, lib/redis.ts must exist first)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `src/middleware.ts` with full auth gate (public routes, JWT verify, Redis revocation check, header propagation)
- Added PUBLIC_PREFIXES for `/api/households`, `/api/demo/`, `/api/auth/session`, `/api/cron/` (future routes)
- Restructured to `(landing)/` and `(app)/` route groups
- Root layout now only contains html/body shell
- `(app)/layout.tsx` holds AppShell + Navigation + DeviceTokenProvider + Toaster
- `(landing)/layout.tsx` has gradient bg, no nav
- Moved home, library, recipes pages into `(app)/`
- Updated Navigation home href from "/" to "/home"
- Updated ConfirmDeleteDialog and RecipeForm to use `/home` redirect
- Navigation tests updated to reflect new `/home` href
- 54 tests passing, 1 pre-existing RecipeCard failure unrelated

### File List

- src/middleware.ts (new)
- src/app/layout.tsx (modified — stripped to HTML shell)
- src/app/(landing)/layout.tsx (new)
- src/app/(landing)/page.tsx (new)
- src/app/(app)/layout.tsx (new)
- src/app/(app)/home/page.tsx (new, moved from src/app/page.tsx)
- src/app/(app)/home/loading.tsx (new, moved from src/app/loading.tsx)
- src/app/(app)/library/page.tsx (new, moved from src/app/library/page.tsx)
- src/app/(app)/library/loading.tsx (new, moved from src/app/library/loading.tsx)
- src/app/(app)/recipes/[id]/page.tsx (new, moved)
- src/app/(app)/recipes/[id]/loading.tsx (new, moved)
- src/app/(app)/recipes/[id]/edit/page.tsx (new, moved)
- src/app/(app)/recipes/new/page.tsx (new, moved)
- src/app/(app)/household/page.tsx (new placeholder)
- src/components/layout/Navigation.tsx (modified — href "/" → "/home")
- src/components/layout/Navigation.test.tsx (modified — updated test expectations)
- src/components/recipes/ConfirmDeleteDialog.tsx (modified — router.push "/home")
- src/components/recipes/RecipeForm.tsx (modified — router.push "/home")
- src/app/page.tsx (deleted)
- src/app/loading.tsx (deleted)
- src/app/library/ (deleted)
- src/app/recipes/ (deleted)

### Change Log

- 2026-03-02: Implemented Story 1.2 — Auth middleware gate + route group restructure
