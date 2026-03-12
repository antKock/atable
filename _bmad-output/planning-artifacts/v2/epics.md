---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
status: complete
completedAt: '2026-03-02'
inputDocuments:
  - "_bmad-output/planning-artifacts/prd-v2.md"
  - "_bmad-output/planning-artifacts/architecture-v2.md"
  - "_bmad-output/planning-artifacts/ux-design-specification-v2.md"
---

# atable v1.5 — Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for atable v1.5 (Household Auth), decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: A new user can choose between creating a household, joining an existing household, or trying a demo from the landing screen
FR2: An unauthenticated user accessing any protected route is redirected to the landing screen
FR3: A user can create a household by providing a household name
FR4: The system auto-generates a unique human-readable join code in WORD-NNNN format (e.g. OLIVE-4821) upon household creation
FR5: A household member can view their household's join code from the household menu
FR6: A household member can copy an invite link for their household from the household menu
FR7: A household member can view and edit the household name from the household menu
FR8: A household member can leave their household from the household menu; if they are the last member, the household and all its data are permanently deleted
FR9: A user can join a household by entering a join code manually
FR10: The system displays the household name for preview before the user confirms joining by code
FR11: A user can join a household by opening an invite link, with the household pre-identified and join requiring a single confirmation tap
FR12: The system rejects join code attempts beyond 5 per hour per IP address
FR13: The system displays an error message when a submitted join code does not match any household
FR14: The system creates a long-lived device session (~1 year) upon joining a household
FR15: A household member can view all devices connected to the household, with device name and last-seen date
FR16: A household member can revoke access for any individual connected device
FR17: A device whose session has been revoked loses access on its next request — no grace period
FR18: Connected devices are identified by a human-readable name (browser/OS/device type)
FR19: A user can access a demo of the app — providing access to all V1 recipe browsing, capture, search, and reading capabilities — without creating a household or entering any credentials
FR20: The demo presents a pre-seeded library with recipe data matching V1 test fixtures
FR21: The system resets all demo data every 24 hours automatically
FR22: A demo user can exit the demo at any time via a persistent "Quitter la démo" banner, returning to the landing screen where they can create or join a household
FR23: Demo recipes are not carried over when a demo user creates their own household
FR24: All application routes except the landing screen (/) and the invite link route (/join/[CODE]) require a valid session
FR25: The invite link route loads the join confirmation screen with the household name pre-populated when opened from external apps (SMS, WhatsApp, email)
FR26: When a user creates the first household on a V1 deployment, all existing recipes are associated with that household in a single atomic operation
FR27: All V1 recipe data is fully accessible and unchanged after household creation

### NonFunctional Requirements

NFR-P1: Middleware session validation adds < 10ms overhead per request (cookie-only JWS verification + Redis GET, no DB call on hot path)
NFR-P2: Landing screen renders in < 500ms (static page, no data fetch required)
NFR-P3: Household creation completes in < 500ms (single DB write + session set)
NFR-P4: Join by code (validation + session creation) completes in < 500ms (one DB read + one write)
NFR-P5: All V1 performance targets (home screen < 1.5s, recipe detail < 1s, search < 100ms, save < 500ms) remain unaffected after auth layer is added
NFR-S1: Session cookie is httpOnly: true, secure: true, sameSite: lax, maxAge: ~365 days
NFR-S2: Cookie payload contains only household ID and device ID; no sensitive personal data; payload is signed, not encrypted
NFR-S3: Join code rate limiting is enforced server-side at ≤ 5 attempts per hour per IP, independently of client behaviour
NFR-S4: A revoked device's session is invalidated within one request cycle — no stale access window
NFR-S5: All V1 security NFRs (HTTPS in transit, data at rest encryption, API write rate limiting) remain in force
NFR-R1: The V1 data migration is atomic: all existing recipes are associated with the new household in a single DB transaction, or none are
NFR-R2: A failed household creation or join attempt leaves no orphaned DB rows
NFR-R3: Demo data reset failure is non-blocking — demo mode remains functional with accumulated test data; no user-visible error
NFR-R4: Any session validation failure produces a clean redirect to the landing screen — never a 5xx error, broken state, or data exposure
NFR-A1: Landing screen, join flows, and household menu meet WCAG 2.1 AA standards (4.5:1 body contrast, 3:1 large text)
NFR-A2: All new interactive elements meet minimum 44×44px touch targets
NFR-A3: All new flows (landing, create, join, household menu) are fully operable via keyboard navigation alone

### Additional Requirements

**From Architecture:**
- New dependencies: `jose` ^6.1.3 (JWS signing), `@upstash/ratelimit` ^2.0.8 (rate limiting), `bowser` ^2.14.1 (UA parsing)
- External service required: Upstash Redis (free tier) for rate limiting and revocation cache
- New env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, SESSION_SIGNING_SECRET, DEMO_HOUSEHOLD_ID, CRON_SECRET
- DB migration `002_household_auth.sql`: new tables `households`, `device_sessions`; `household_id` FK on `recipes`
- Middleware replaces V1 stub: JWS verify + Redis revocation check, forwards x-household-id header to all authenticated routes
- All recipe queries in V1 route handlers must be scoped to household_id (Gap 1 — critical to resolve first)
- Navigation home link must update from href="/" to href="/home" (Gap 2)
- New route group structure: (landing)/ for public routes, (app)/ for authenticated routes; home URL changes from "/" to "/home"
- `supabase/seed.sql` needed for demo household row + ~10 seed recipes (Gap 3 — required before deploy)
- `vercel.json` Cron config for 24h demo reset: `"0 3 * * *"` pointing to `/api/cron/demo-reset`
- Session utility centralization: all jose operations via `lib/auth/session.ts` only; all Redis via `lib/redis.ts` singleton
- Device name format: `"{Device} · {Browser}"` using U+00B7 middle dot, via `lib/auth/device-name.ts` (bowser)
- Join code format: uppercase WORD-NNNN, validation regex `/^[A-Z]+-\d{4}$/`
- V1 atomic migration triggered only when `SELECT COUNT(*) FROM recipes WHERE household_id IS NULL > 0`
- `revalidatePath` calls: PUT households/[id] → '/household'; DELETE devices/[id] → '/household'; DELETE households/[id] → '/'
- All auth failures redirect to landing (/) — never return 401/403, never 5xx

**From UX:**
- Landing screen must signal "food/kitchen/atable" visually before any text is read (warm gradient background or food imagery)
- Join confirmation screen must show household name prominently as the hero — "Rejoindre *Chez nous*?" framing
- Household name is the hero in post-creation confirmation — "Foyer *Chez nous* créé. Code : OLIVE-4821."
- DemoBanner ("Quitter la démo") is persistent, non-intrusive, always accessible — fixed element in nav area
- Error messages use household language, not technical language (e.g. "Ce code ne correspond à aucun foyer")
- Joining framed as invitation: "Rejoindre" not "S'inscrire"; all copy reinforces household-as-shared-space
- useOptimistic for device revocation — device disappears immediately from list, reappears on server error
- All new screens follow V1 mobile-first single-breakpoint (lg) layout; no new breakpoints
- Household menu accessible via icon-only button in home screen header top-right (not nav bar)

### FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR1 | Epic 1 | Landing screen with 3 options |
| FR2 | Epic 1 | Unauthenticated redirect to landing |
| FR3 | Epic 1 | Household creation with name |
| FR4 | Epic 1 | Auto-generated WORD-NNNN join code |
| FR5 | Epic 4 | View join code from household menu |
| FR6 | Epic 4 | Copy invite link from household menu |
| FR7 | Epic 4 | View and edit household name |
| FR8 | Epic 4 | Leave household (last member deletes all data) |
| FR9 | Epic 2 | Manual code entry |
| FR10 | Epic 2 | Household name preview before confirm |
| FR11 | Epic 2 | Join via invite link (one-tap confirm) |
| FR12 | Epic 2 | Rate limiting (5/hr/IP) |
| FR13 | Epic 2 | Error on unknown code |
| FR14 | Epic 1+2 | Long-lived session on creation/join (implemented in Epic 1, used in Epic 2) |
| FR15 | Epic 4 | Device list with name + last-seen |
| FR16 | Epic 4 | Per-device revocation |
| FR17 | Epic 4 | Immediate session invalidation on revoke |
| FR18 | Epic 4 | Human-readable device name (UA parsing) |
| FR19 | Epic 3 | Demo access without credentials |
| FR20 | Epic 3 | Pre-seeded demo library |
| FR21 | Epic 3 | 24h automated demo reset |
| FR22 | Epic 3 | Persistent "Quitter la démo" exit banner |
| FR23 | Epic 3 | Demo data not carried over on conversion |
| FR24 | Epic 1 | Auth gate on all routes except / and /join/[CODE] |
| FR25 | Epic 2 | Invite link loads join confirmation with household name pre-populated |
| FR26 | Epic 1 | Atomic V1 migration on first household creation |
| FR27 | Epic 1 | All V1 data preserved and accessible |

## Epic List

### Epic 1: Household Creation & Auth Foundation
A user can create a named household, establish a long-lived device session, and access their protected recipe library with all V1 data intact.
**FRs covered:** FR1, FR2, FR3, FR4, FR14, FR24, FR26, FR27

### Epic 2: Joining a Household
A user can join an existing household via invite link (one tap) or manual code entry (with household name preview), and immediately access the shared library.
**FRs covered:** FR9, FR10, FR11, FR12, FR13, FR14, FR25

### Epic 3: Demo Mode
A new user can explore the full app experience with a realistic pre-seeded library — no credentials required — and convert to their own household when ready.
**FRs covered:** FR19, FR20, FR21, FR22, FR23

### Epic 4: Household Management & Device Control
A household member can view and share the household code and invite link, rename the household, manage connected devices, revoke any device, and leave the household.
**FRs covered:** FR5, FR6, FR7, FR8, FR15, FR16, FR17, FR18

---

## Epic 1: Household Creation & Auth Foundation

A user can create a named household, establish a long-lived device session, and access their protected recipe library with all V1 data intact.

### Story 1.1: DB Schema Migration & Auth Infrastructure

As a developer deploying atable v1.5,
I want the database schema extended with household and device tables, and core auth utilities in place,
So that all subsequent auth features have a reliable technical foundation to build on.

**Acceptance Criteria:**

**Given** a Supabase project with the V1 schema
**When** migration `002_household_auth.sql` is applied
**Then** the `households` table exists with: `id` (UUID PK), `name` (TEXT NOT NULL), `join_code` (TEXT NOT NULL UNIQUE), `is_demo` (BOOLEAN NOT NULL DEFAULT false), `created_at` (TIMESTAMPTZ)
**And** the `device_sessions` table exists with: `id` (UUID PK), `household_id` (UUID FK → households ON DELETE CASCADE), `device_name` (TEXT NOT NULL), `last_seen_at` (TIMESTAMPTZ), `created_at` (TIMESTAMPTZ), `is_revoked` (BOOLEAN NOT NULL DEFAULT false)
**And** indexes exist on `device_sessions(household_id)` and `recipes(household_id)`
**And** the `recipes` table has a nullable `household_id` column (UUID FK → households ON DELETE SET NULL)

**Given** `lib/auth/session.ts`
**When** it is imported
**Then** it exports `signSession(payload: SessionPayload)`, `verifySession(token: string)`, `setSessionCookie(response, payload)`, `clearSessionCookie(response)`, and the `SessionPayload` type `{ hid: string; sid: string; iat: number }`
**And** it is the only file in the codebase that imports `jose` directly

**Given** `lib/auth/join-code.ts`
**When** `generateJoinCode()` is called
**Then** it returns a string matching `/^[A-Z]+-\d{4}$/` (e.g. `OLIVE-4821`) drawn from the curated food/kitchen word list

**Given** `lib/auth/device-name.ts`
**When** `getDeviceName(userAgent: string)` is called
**Then** it returns a string in the format `"{Device} · {Browser}"` using the U+00B7 middle dot (e.g. `"iPhone 15 Pro · Safari"`)
**And** for unknown or empty user agents it returns `"Appareil inconnu · Navigateur inconnu"` or a partial fallback

**Given** `lib/redis.ts`
**When** it is imported
**Then** it exports a singleton Upstash Redis client and a `joinRateLimit` Ratelimit instance configured for 5 requests/hour sliding window
**And** it is the only file in the codebase that instantiates `new Redis()`

**Given** `src/types/household.ts`
**When** imported
**Then** it exports `Household`, `DeviceSession`, and `SessionPayload` types matching the architecture specification

**Given** `lib/schemas/household.ts`
**When** imported
**Then** it exports `HouseholdCreateSchema` (validates household name: non-empty string, max 50 chars) and `JoinCodeSchema` (validates WORD-NNNN format via regex)

---

### Story 1.2: Authentication Middleware Gate

As a household member,
I want the application to validate my session on every page load and redirect me to the landing screen if I'm not authenticated,
So that the recipe library is private to my household and inaccessible without a valid session.

**Acceptance Criteria:**

**Given** an unauthenticated user (no `atable_session` cookie)
**When** they navigate to any route except `/` and `/join/[code]`
**Then** they are redirected to `/`

**Given** an authenticated user with a valid `atable_session` cookie
**When** they navigate to `/`
**Then** they are redirected to `/home`

**Given** a valid `atable_session` cookie arriving in middleware
**When** middleware validates it
**Then** the JWS signature is verified using `lib/auth/session.ts` (no DB call)
**And** Redis `GET revoked:{sid}` is checked
**And** `x-household-id` and `x-session-id` request headers are set on the forwarded request
**And** total middleware processing overhead is under 10ms

**Given** a revoked session (Redis key `revoked:{sid}` exists)
**When** the revoked device makes any authenticated request
**Then** they are redirected to `/`
**And** no recipe data is exposed

**Given** `PUBLIC_ROUTES` constant in `middleware.ts`
**When** a request arrives for `/` or `/join/[code]`
**Then** it passes through without session validation

**Given** any session validation failure (malformed token, expired signature, missing cookie)
**When** the failure is caught in middleware
**Then** the user is redirected to `/` — never a 5xx error, never a broken state

**Given** the route group structure in `src/app/`
**When** the `(landing)/` layout is rendered
**Then** it uses `LandingLayout` with no navigation bar and gradient background

**Given** the `(app)/` route group
**When** any authenticated route is rendered
**Then** it uses `AppShell` with the navigation bar (moved from root layout)
**And** the home URL within the app is `/home`, not `/`

**Given** the V1 `Navigation` component
**When** rendered
**Then** the home icon/link points to `href="/home"` (not `"/"`)

---

### Story 1.3: Household Creation & V1 Data Migration

As a V1 user opening atable after the v1.5 upgrade,
I want to see the landing screen, create a named household, and have all my existing recipes automatically associated with it,
So that I can access my complete, unchanged recipe library as a private, named household.

**Acceptance Criteria:**

**Given** an unauthenticated user arriving at `/`
**When** the landing screen renders
**Then** they see three options: "Essayer l'app", "Créer un foyer", "Rejoindre un foyer"
**And** the screen uses atable's warm visual language (gradient background, food imagery or warm palette)
**And** the page renders in under 500ms (static, no data fetch)
**And** all touch targets are at least 44×44px and the screen is keyboard navigable

**Given** the landing screen
**When** a user taps "Créer un foyer"
**Then** the `CreateHouseholdForm` is shown with a single household name text field

**Given** the `CreateHouseholdForm` with a valid household name submitted
**When** `POST /api/households` is called
**Then** the request is validated with `HouseholdCreateSchema`

**Given** `POST /api/households` with a valid name and existing V1 recipes (`household_id IS NULL`)
**When** the request executes
**Then** a single atomic DB transaction runs: INSERT household → INSERT device_session → UPDATE recipes SET household_id WHERE household_id IS NULL
**And** if any step fails, the full transaction rolls back — no household row, no device_session row, no recipe modification
**And** the new household has a `join_code` in WORD-NNNN format generated by `lib/auth/join-code.ts`

**Given** the atomic transaction succeeds
**When** the response is sent
**Then** an `atable_session` cookie is set: `httpOnly: true`, `secure: true`, `sameSite: lax`, `maxAge: 60 * 60 * 24 * 365`
**And** the cookie payload is signed JWS containing only `{ hid, sid, iat }` (no PII)
**And** the user is redirected to `/home`

**Given** the user lands on `/home` after household creation
**When** the home screen renders
**Then** a `PostCreationBanner` is displayed showing the household name and the WORD-NNNN join code
**And** the banner includes a copy affordance for the code

**Given** all V1 recipes after successful household creation
**When** the home screen and library are loaded
**Then** all recipes are visible and accessible, with content unchanged

**Given** the V1 recipe API routes (`/api/recipes` and `/api/recipes/[id]`)
**When** any authenticated request arrives
**Then** all Supabase queries on the `recipes` table include `.eq('household_id', householdId)` using the `x-household-id` header
**And** `householdId` is always read from `(await headers()).get('x-household-id')` — never re-parsed from the cookie

**Given** a `POST /api/households` failure at any stage
**When** the error is caught
**Then** no partial DB state is left (no orphaned households or device_sessions)
**And** the user receives an error message and remains on the landing screen

---

## Epic 2: Joining a Household

A user can join an existing household via invite link (one tap) or manual code entry (with household name preview), and immediately access the shared library.

### Story 2.1: Join via Manual Code Entry

As a new household member who has received a join code,
I want to enter the code on the landing screen, preview the household name before confirming, and join with one tap,
So that I can join my household reliably even if the invite link didn't work.

**Acceptance Criteria:**

**Given** the landing screen
**When** a user taps "Rejoindre un foyer"
**Then** the `CodeEntryForm` is shown with a single join code input field and a placeholder indicating the WORD-NNNN format

**Given** the `CodeEntryForm` input
**When** the entered text does not match `/^[A-Z]+-\d{4}$/`
**Then** the submit/lookup action is not triggered (format validation before network call)

**Given** the `CodeEntryForm` with a valid-format code
**When** the user submits
**Then** `GET /api/households/lookup?code=WORD-NNNN` is called

**Given** `GET /api/households/lookup` with a code matching an existing household
**When** the response arrives
**Then** the form displays a household name preview: "Foyer *{name}* trouvé — Rejoindre ?"
**And** a single confirm CTA is shown

**Given** `GET /api/households/lookup` with a code matching no household
**When** the response arrives
**Then** the error message "Ce code ne correspond à aucun foyer" is shown on the form

**Given** the household name preview is shown
**When** the user taps confirm
**Then** `POST /api/households/join` is called with the code

**Given** `POST /api/households/join` succeeds
**When** the response arrives
**Then** an `atable_session` cookie is set (same spec as creation: httpOnly, secure, sameSite: lax, maxAge: 365d)
**And** the user is redirected to `/home`
**And** a new `device_sessions` row exists for this device with a human-readable device name

**Given** more than 5 requests from the same IP within 1 hour to `/api/households/lookup` or `/api/households/join`
**When** the 6th request arrives
**Then** a 429 response is returned with `{ error: 'Trop de tentatives, réessayez plus tard' }`

**Given** the `CodeEntryForm` on mobile
**When** rendered
**Then** all interactive elements are at least 44×44px and the form is keyboard navigable

---

### Story 2.2: Join via Invite Link

As a new household member receiving an invite link via iMessage, SMS, or WhatsApp on iOS,
I want to tap the link, see the household name pre-identified, and join with a single confirmation tap,
So that I can join the shared library in seconds without typing anything.

**Acceptance Criteria:**

**Given** a user tapping a link `https://atable.app/join/OLIVE-4821` from iMessage, SMS, or WhatsApp on iOS
**When** the link is opened
**Then** it opens in Safari and renders the `(landing)/join/[code]/page.tsx` page
**And** the page loads within 500ms

**Given** the `/join/[code]` page
**When** it loads with a valid code
**Then** the household name is fetched server-side (no client-side loading state)
**And** the hero text displays "Rejoindre *{name}* ?" with the household name prominent
**And** a single confirm CTA is present

**Given** `/join/[code]` in the middleware `PUBLIC_ROUTES`
**When** an unauthenticated user opens this route
**Then** it passes through without session validation (no redirect to `/`)

**Given** the confirm CTA tapped
**When** `POST /api/households/join` is called
**Then** a long-lived `atable_session` cookie is set (same spec as creation)
**And** the user is redirected to `/home`

**Given** an invalid or non-existent code in the URL
**When** the `/join/[code]` page renders
**Then** an error message is shown (e.g. "Ce lien ne correspond à aucun foyer")
**And** a link back to the landing screen is displayed

**Given** an authenticated user (already has a valid session) opening `/join/[code]`
**When** middleware processes the request
**Then** the page renders normally — it is in `PUBLIC_ROUTES` and passes through regardless of session state

---

## Epic 3: Demo Mode

A new user can explore the full app experience with a realistic pre-seeded library — no credentials required — and convert to their own household when ready.

### Story 3.1: Demo Mode Entry with Seed Data

As a first-time visitor who wants to try atable without commitment,
I want to tap "Essayer l'app" and immediately enter a fully-stocked recipe library,
So that I can experience the full app before deciding to create my own household.

**Acceptance Criteria:**

**Given** the landing screen
**When** a user taps "Essayer l'app"
**Then** `POST /api/demo/session` is called without any credentials or input

**Given** `POST /api/demo/session`
**When** the request succeeds
**Then** an `atable_session` cookie is set pointing to `DEMO_HOUSEHOLD_ID` (same cookie spec as real sessions)
**And** the user is redirected to `/home`

**Given** `supabase/seed.sql` run against the database
**When** applied
**Then** a household row with `is_demo = true` is created
**And** at least 10 realistic French recipes with `household_id = DEMO_HOUSEHOLD_ID` are inserted
**And** `DEMO_HOUSEHOLD_ID` is documented in `.env.example`

**Given** the demo library at `/home`
**When** the user arrives
**Then** all V1 features are functional: home carousels, library grid, search, recipe detail view, recipe capture, recipe editing
**And** the library contains the pre-seeded recipes with warm visuals

**Given** a demo session in middleware
**When** requests are processed
**Then** the demo session is treated identically to a real session (same `x-household-id` propagation)
**And** `is_demo` logic is isolated to `POST /api/demo/session` and `POST /api/cron/demo-reset` only

---

### Story 3.2: Demo Exit Banner & Automated Reset

As a demo user,
I want a persistent, unobtrusive exit option always visible, and to trust that demo data resets daily,
So that I can freely explore without commitment and convert cleanly to my own household when ready.

**Acceptance Criteria:**

**Given** an active demo session on any authenticated page
**When** the page renders
**Then** the `DemoBanner` ("Quitter la démo") is persistently visible — fixed in the nav area or as a non-intrusive top banner
**And** it does not obscure core recipe content or interactive elements

**Given** the `DemoBanner`
**When** the user taps "Quitter la démo"
**Then** `DELETE /api/auth/session` is called to clear the `atable_session` cookie
**And** the user is redirected to `/`

**Given** the user arriving at the landing screen after demo exit
**When** they create or join a household
**Then** they enter a fresh household with zero demo data — no demo recipes carried over

**Given** `vercel.json` Cron configuration
**When** the cron runs at `0 3 * * *` UTC
**Then** `POST /api/cron/demo-reset` is called

**Given** `POST /api/cron/demo-reset` with a valid `CRON_SECRET` header
**When** the request runs
**Then** all user-created recipes in the demo household (added since last reset) are deleted
**And** seed recipes are restored to their original seeded state
**And** the response returns 200 on success

**Given** `POST /api/cron/demo-reset` without a valid `CRON_SECRET` header
**When** the request arrives
**Then** it returns 401 and performs no operations

**Given** `POST /api/cron/demo-reset` encountering a DB error
**When** the error occurs
**Then** it is logged but does not cascade to a broken demo experience
**And** demo mode remains functional with accumulated test data (non-blocking failure)

---

## Epic 4: Household Management & Device Control

A household member can view and share the household code and invite link, rename the household, manage connected devices, revoke any device, and leave the household.

### Story 4.1: Household Menu with Code & Invite Link

As a household member,
I want to open a household menu from the home screen header and copy my join code or invite link,
So that I can share access with others at any time.

**Acceptance Criteria:**

**Given** the `/home` page header
**When** the user views it
**Then** there is an icon-only button in the top-right corner that navigates to `/household`
**And** the button is not in the bottom nav bar
**And** it meets the 44×44px touch target minimum

**Given** the `/household` page
**When** it loads
**Then** the household name, join code, invite link, device list section, and leave option are all rendered
**And** the page loads within 1.5s

**Given** the `CodeDisplay` component
**When** rendered
**Then** the join code is shown in `WORD-NNNN` format
**And** tapping the copy affordance places the code text on the clipboard
**And** a brief confirmation feedback is shown ("Copié !")

**Given** the `InviteLinkDisplay` component
**When** rendered
**Then** the full invite URL (e.g. `https://atable.app/join/OLIVE-4821`) is displayed
**And** tapping the copy affordance places the full URL on the clipboard
**And** a brief confirmation feedback is shown

**Given** the `/household` page
**When** keyboard navigation is used
**Then** all interactive elements are reachable and operable via keyboard alone

---

### Story 4.2: Household Rename

As a household member,
I want to rename my household directly from the household menu,
So that I can update the name at any time.

**Acceptance Criteria:**

**Given** the `/household` page
**When** the user views the household name
**Then** there is an edit affordance (pencil icon) adjacent to the name

**Given** the `InlineEditableField` component
**When** the user taps the pencil icon
**Then** the household name text switches to an input field with the current name pre-filled

**Given** the inline edit field
**When** the user submits a new non-empty name
**Then** `PUT /api/households/[id]` is called with the new name
**And** on success, the displayed name updates immediately without a page reload
**And** `revalidatePath('/household')` is called server-side

**Given** `PUT /api/households/[id]`
**When** the name passes `HouseholdCreateSchema` validation
**Then** the `households` table is updated and the response includes the updated name

**Given** the inline edit field
**When** the user submits an empty string or presses cancel
**Then** the field reverts to the current name without making an API call

---

### Story 4.3: Device Management & Revocation

As a household member,
I want to see all devices connected to my household and revoke any device that should no longer have access,
So that I can secure our household library if a device is lost or shared.

**Acceptance Criteria:**

**Given** the `/household` page loading
**When** `GET /api/devices` responds
**Then** all non-revoked `device_sessions` for the household are listed
**And** each device shows: device name (e.g. "iPhone 15 Pro · Safari") and last-seen date in French (e.g. "il y a 3 semaines")

**Given** the `DeviceListItem` for the current device (matching `x-session-id` header)
**When** rendered
**Then** it has a visual indicator distinguishing it as "cet appareil"
**And** its revoke button is disabled (a device cannot revoke itself)

**Given** a `DeviceListItem` for a different device
**When** the user taps the revoke button
**Then** a confirmation dialog appears: "Révoquer l'accès ?"

**Given** the revocation confirmation
**When** the user confirms
**Then** the device disappears from the list immediately via `useOptimistic` (optimistic update)
**And** `DELETE /api/devices/[id]` is called in the background

**Given** `DELETE /api/devices/[id]`
**When** the request succeeds
**Then** the `device_sessions` row is marked `is_revoked = true` in DB
**And** `Redis SET revoked:{sid} 1 EX 31536000` is called
**And** `revalidatePath('/household')` is called

**Given** `DELETE /api/devices/[id]` failing
**When** the server returns an error
**Then** the device reappears in the list (optimistic rollback)
**And** an error message is shown to the user

**Given** the revoked device making any subsequent request
**When** middleware checks `Redis GET revoked:{sid}`
**Then** the device is redirected to `/` on its next request — no grace period

---

### Story 4.4: Leave Household

As a household member,
I want to leave my household from the household menu,
So that I can disconnect this device from the shared library.

**Acceptance Criteria:**

**Given** the `/household` page
**When** the user taps "Quitter le foyer"
**Then** a confirmation dialog appears

**Given** the confirmation dialog when the user is NOT the last member
**When** they confirm
**Then** `DELETE /api/households/[id]` is called
**And** the session cookie is cleared via `clearSessionCookie`
**And** the user is redirected to `/`

**Given** the confirmation dialog when the user IS the last member
**When** they view the dialog
**Then** it explicitly warns that all household data (recipes, etc.) will be permanently deleted

**Given** the last-member deletion confirmed
**When** `DELETE /api/households/[id]` runs
**Then** all recipes belonging to the household are explicitly deleted first (DELETE WHERE household_id = $1)
**And** the household row is then deleted, triggering ON DELETE CASCADE on `device_sessions`
**And** the session cookie is cleared
**And** the user is redirected to `/`

**Given** a successful leave (any member)
**When** the user lands on `/`
**Then** they see the landing screen and can create or join a new household
