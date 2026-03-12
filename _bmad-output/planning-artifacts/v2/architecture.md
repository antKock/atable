---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-02'
status: 'in-progress'
inputDocuments:
  - "_bmad-output/planning-artifacts/prd-v2.md"
  - "_bmad-output/planning-artifacts/ux-design-specification-v2.md"
  - "_bmad-output/planning-artifacts/architecture.md"
workflowType: 'architecture'
project_name: 'atable'
user_name: 'Anthony'
date: '2026-03-02'
---

# Architecture Decision Document — atable v1.5 (Household Auth)

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (27 FRs across 7 capability areas):**

- **Onboarding & Entry (FR1–2):** Landing screen with 3 options (demo / create / join); unauthenticated redirect to landing for all protected routes.
- **Household Management (FR3–8):** Create household with name → auto-generated WORD-NNNN code; view/copy code + invite link from menu; edit household name; leave household with last-member deletion of all data.
- **Joining a Household (FR9–13):** Manual code entry with format validation + household name preview before confirm; invite link join with one-tap confirm; server-side rate limiting (5/hr/IP); error on unknown code.
- **Session & Device Management (FR14–18):** ~1-year httpOnly session cookie on join; device list with human-readable names + last-seen; per-device revocation; immediate invalidation (next request); current device non-revocable by self.
- **Demo Mode (FR19–23):** Full V1 experience with no credentials; pre-seeded realistic library; 24h automated reset; persistent non-intrusive "Quitter la démo" banner; demo data not carried over on conversion.
- **Authentication Gate (FR24–25):** All routes except `/` and `/join/[CODE]` require valid session; invite link route works correctly from SMS/WhatsApp/iMessage on iOS (sameSite:lax).
- **Data Migration (FR26–27):** Atomic association of all existing V1 recipes to the new household on first household creation; all V1 data preserved and accessible post-migration.

**Non-Functional Requirements:**

| Category | Key Requirements |
|---|---|
| **Performance** | Middleware overhead <10ms/request (cookie-only validation, no DB on hot path); landing <500ms; household creation/join <500ms; all V1 perf targets unaffected (home <1.5s, search <100ms, save <500ms) |
| **Security** | httpOnly + secure + sameSite:lax + ~365d maxAge session cookie; signed payload with household ID + device ID only (no PII); server-side rate limiting 5/hr/IP on code entry; immediate revocation (no grace period); all V1 security NFRs preserved |
| **Reliability** | Atomic V1 migration (all recipes associated or zero); no orphaned DB rows on failed create/join; demo reset failure non-blocking; all auth failures redirect to landing (never 5xx, never broken state) |
| **Accessibility** | WCAG 2.1 AA (4.5:1 contrast on gradient); 44×44px touch targets; keyboard navigation; VoiceOver on iOS; aria-describedby on all form errors |

**Scale & Complexity:**

- Primary domain: Full-stack web (Next.js App Router + Supabase + Vercel)
- Complexity level: **Low-Medium** — standard session patterns, brownfield integration risk, atomic migration as the high-risk deliverable
- Estimated new architectural components: ~9 (middleware auth gate, session signing lib, households API, devices API, demo API + cron, join route, landing screen, household menu, V1 migration logic)

### Technical Constraints & Dependencies

- **Stack fixed (V1 inheritance):** Next.js App Router, Tailwind CSS v4, shadcn/ui, Supabase (PostgreSQL + Storage), Vercel — no new infrastructure introduced
- **Custom auth — no third-party provider:** No Supabase Auth, no NextAuth, no OAuth. Deliberate: eliminates individual account complexity, enables long-lived device trust without per-user session management overhead.
- **iOS Safari as primary surface:** `sameSite: lax` required for invite links to work from external apps (WhatsApp, SMS, iMessage). Cookie persistence on iOS Safari verified in testing — ITP is mitigated by first-party, HTTPS-only, non-JS-accessible cookies.
- **Brownfield constraint:** V1 is deployed and actively used. Auth layer is purely additive — zero changes to existing recipe API routes, existing component behavior, or existing V1 performance targets.
- **V1 schema hook already exists:** `recipes.user_id` (nullable UUID) was planned in V1 architecture for this moment. V1.5 adds a new `household_id` column (also UUID, nullable V1, required V1.5+) rather than repurposing `user_id` — keeping future individual auth separate.
- **Existing middleware.ts:** V1 already has `middleware.ts` for rate limiting. V1.5 replaces it with the full auth gate, incorporating rate limiting as a sub-concern.

### Cross-Cutting Concerns Identified

1. **Session validation performance** — Middleware validates the signed cookie cryptographically on every request (<10ms). No DB call on the hot path. DB is consulted only at household menu load (device list) and on revocation.
2. **Device identification** — Human-readable names ("iPhone 15 · Safari") derived server-side from `User-Agent` at session creation. Must handle unknown UAs gracefully with a fallback ("Appareil inconnu").
3. **Rate limiting on code entry** — 5 attempts/hr/IP enforced server-side on `/api/households/lookup` and `/api/households/join`. V1's stub middleware is replaced with actual enforcement.
4. **Atomic V1 data migration** — Single DB transaction on first household creation: create household + device + `UPDATE recipes SET household_id = $1 WHERE household_id IS NULL`. Complete rollback on any failure.
5. **Demo isolation** — Shared `is_demo` household row, 24h Vercel Cron reset. Same cookie/session mechanism as real sessions; distinguished by `is_demo` flag. Cron failure non-blocking.
6. **iOS Safari cookie reliability** — `sameSite: lax`, `secure: true`, `httpOnly: true`, first-party only. `/join/[CODE]` must open in Safari (not WebView) from external apps — `sameSite: lax` enables this cross-context navigation.
7. **New DB schema layer** — 3 new tables: `households`, `devices`, `sessions`. Plus `household_id` FK on `recipes`. Schema must not conflict with future full-v2 additions.
8. **V1 non-regression** — New middleware wraps all requests; must fail-safe to landing (never 5xx), add imperceptible overhead, and preserve all V1 route behavior and API contracts exactly.

## Starter Template Evaluation

### Primary Technology Domain

Brownfield full-stack web application — V1 is deployed. No new project scaffold required.

### Brownfield Foundation

The V1 codebase provides the complete stack foundation:
- **Framework:** Next.js App Router (TypeScript, `src/` dir, `@/*` alias)
- **Styling:** Tailwind CSS v4 + shadcn/ui (themed for atable)
- **Backend:** Supabase PostgreSQL + Storage
- **Deployment:** Vercel (auto-deploy on push to main)
- **Build:** Turbopack (dev), Next.js bundler (prod)

All V1 conventions (naming, structure, patterns) documented in `architecture.md` are inherited unchanged.

### New Dependencies for V1.5

| Package | Version | Purpose |
|---|---|---|
| `jose` | ^6.1.3 | Session cookie signing/verification in Edge Runtime middleware — Web Crypto native, no Node.js deps |
| `@upstash/ratelimit` | ^2.0.8 | Per-IP sliding window rate limiting across serverless instances — activated from V1 stub |
| `bowser` | ^2.14.1 | User-Agent parsing → human-readable device names ("iPhone 15 · Safari") |

**External service required:** Upstash Redis project (free tier sufficient) for `@upstash/ratelimit` persistent storage.

**New environment variables:**
```
UPSTASH_REDIS_REST_URL=      # Upstash dashboard
UPSTASH_REDIS_REST_TOKEN=    # Upstash dashboard
SESSION_SIGNING_SECRET=      # min 32 chars, generated with crypto.randomBytes(32)
```

**Note:** No `create-next-app` initialization needed. First implementation story is DB schema migration, not project scaffold.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- DB schema: `households` + `device_sessions` tables + `household_id` on `recipes`
- Session model: JWS-signed cookie (`jose`) + Redis revocation cache (Upstash)
- Middleware strategy: signature validation + Redis check, no DB on hot path
- V1 migration: atomic transaction at first household creation
- Route exclusions: `/` and `/join/[CODE]` are public; all others auth-gated

**Important Decisions (Shape Architecture):**
- Join code generation: food word list + 4-digit suffix, server-side
- Demo session lifecycle: same mechanism as real sessions, cron resets data not sessions
- Revocation enforcement: Redis key `revoked:{session_id}` for immediate cross-request effect

**Deferred Decisions (Post-v1.5):**
- Session sliding window renewal (auto-extending ~1yr sessions on activity)
- Multi-household support
- Per-member permissions within household

### Data Architecture

**DB Schema: New Tables**

```sql
CREATE TABLE households (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  join_code   TEXT        NOT NULL UNIQUE,  -- WORD-NNNN format
  is_demo     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE device_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  device_name  TEXT        NOT NULL,         -- "iPhone 15 · Safari", derived from UA
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  is_revoked   BOOLEAN     NOT NULL DEFAULT false
);
CREATE INDEX ON device_sessions(household_id);
```

`recipes` migration:
```sql
ALTER TABLE recipes ADD COLUMN household_id UUID REFERENCES households(id) ON DELETE SET NULL;
CREATE INDEX ON recipes(household_id);
-- user_id column kept as-is (reserved for future individual auth)
```

**Session Model: JWS Signed Cookie**
- Library: `jose` v6.x — JWS (signed, not encrypted), HS256 algorithm
- Payload: `{ hid: string, sid: string, iat: number }` (household ID + device session ID + issued-at)
- No sensitive data in payload — no household name, no device name
- Cookie name: `atable_session`
- Verification is purely cryptographic in middleware (no DB call)

**Revocation Cache: Upstash Redis**
- On revoke: `SET revoked:{session_id} 1 EX 31536000` (1-year TTL)
- Middleware check: `GET revoked:{session_id}` — if `1`, redirect to landing
- Same Upstash Redis instance used for both revocation cache and rate limiting
- Key namespaces: `revoked:` prefix for revocation, `rl:` prefix for rate limiting

**Join Code Generation:**
- Word list: curated food/kitchen terms (~50 words: OLIVE, THYME, CUMIN, ANISE, BASIL, FENNEL, CAPER, SORREL, etc.)
- Format: `{WORD}-{0000–9999}` → ~500,000 unique combinations
- Uniqueness: retry once on collision (negligible probability at household scale)
- Implementation: `src/lib/auth/join-code.ts`

**V1 Data Migration:**
- Triggered: at household creation if `SELECT COUNT(*) FROM recipes WHERE household_id IS NULL > 0`
- Atomic transaction:
  1. `INSERT INTO households …` → get `household_id`
  2. `INSERT INTO device_sessions …` → get `session_id`
  3. `UPDATE recipes SET household_id = $1 WHERE household_id IS NULL`
  4. Any failure → full rollback, no household created, no data touched

### Authentication & Security

**Session Middleware — Hot Path:**
```
Request arrives
  → middleware.ts: validate atable_session cookie (JWS verify with jose, ~1ms)
  → if invalid/missing: redirect to /
  → extract { hid, sid } from payload
  → Redis GET revoked:{sid} (~2–5ms)
  → if revoked: redirect to /
  → set request headers: x-household-id, x-session-id
  → forward request
Total overhead: ~3–7ms (within NFR-P1 <10ms)
```

**Public Routes (no middleware auth gate):**
- `/` — landing screen
- `/join/[code]` — invite link target
- `/api/households` (POST) — household creation
- `/api/households/lookup` (GET) — code lookup
- `/api/households/join` (POST) — join via code
- `/api/demo/session` (POST) — demo session creation
- `/api/auth/session` (DELETE) — clear session cookie
- `/api/cron/demo-reset` (POST) — validated by CRON_SECRET header, not session cookie

**Cookie Specification:**
```ts
{
  name: 'atable_session',
  httpOnly: true,
  secure: true,          // HTTPS only — Vercel default
  sameSite: 'lax',       // Required for /join/[CODE] to work from WhatsApp/SMS on iOS
  maxAge: 60 * 60 * 24 * 365,
  path: '/'
}
```

**Rate Limiting on Join Endpoints:**
- Algorithm: Sliding Window (Upstash `@upstash/ratelimit`)
- Limit: 5 requests per hour per IP
- Applied to: `GET /api/households/lookup` + `POST /api/households/join`
- On limit: `429` with `{ error: 'Trop de tentatives, réessayez plus tard' }`
- Redis key: `rl:join:{ip}`

### API & Communication Patterns

**New Route Handlers:**

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/households` | No | Create household + set session cookie |
| `GET` | `/api/households/lookup?code=WORD-NNNN` | No | Look up household by code (preview) |
| `POST` | `/api/households/join` | No | Join household by code + set session |
| `PUT` | `/api/households/[id]` | Yes | Rename household |
| `DELETE` | `/api/households/[id]` | Yes | Leave/delete household |
| `GET` | `/api/devices` | Yes | List connected devices |
| `DELETE` | `/api/devices/[id]` | Yes | Revoke device session |
| `POST` | `/api/demo/session` | No | Create demo session cookie |
| `DELETE` | `/api/auth/session` | No | Clear session cookie |
| `POST` | `/api/cron/demo-reset` | CRON_SECRET | Reset demo recipes |

**Household ID Propagation:**
- Middleware sets `x-household-id` and `x-session-id` request headers
- All Server Components and Route Handlers read from headers — no redundant cookie parsing
- All recipe queries scoped: `WHERE household_id = $householdId`

### Frontend Architecture

**New Route Groups:**
```
app/
  (auth)/              ← LandingLayout — no nav bar
    page.tsx            ← landing screen
    join/[code]/page.tsx ← invite link confirmation
  (app)/               ← AppShell — with nav (existing V1 structure, renamed from root)
    (home)/page.tsx
    library/page.tsx
    recipes/…
    household/page.tsx  ← household menu (new)
```

**New Pages/Components:**

| Component | Path | Type |
|---|---|---|
| `LandingScreen` | `components/auth/LandingScreen.tsx` | Client |
| `CreateHouseholdForm` | `components/auth/CreateHouseholdForm.tsx` | Client |
| `JoinConfirmation` | `components/auth/JoinConfirmation.tsx` | Client |
| `CodeEntryForm` | `components/auth/CodeEntryForm.tsx` | Client |
| `CodeDisplay` | `components/household/CodeDisplay.tsx` | Client |
| `InviteLinkDisplay` | `components/household/InviteLinkDisplay.tsx` | Client |
| `DeviceListItem` | `components/household/DeviceListItem.tsx` | Client |
| `DemoBanner` | `components/demo/DemoBanner.tsx` | Client |
| `InlineEditableField` | `components/household/InlineEditableField.tsx` | Client |

**State Management:** Unchanged from V1. `useOptimistic` for device revocation (device disappears immediately, reappears on server error).

### Infrastructure & Deployment

**New Environment Variables:**
```
UPSTASH_REDIS_REST_URL=        # Upstash dashboard
UPSTASH_REDIS_REST_TOKEN=      # Upstash dashboard
SESSION_SIGNING_SECRET=        # min 32 chars (crypto.randomBytes(32).toString('hex'))
DEMO_HOUSEHOLD_ID=             # UUID of the permanent demo household row
CRON_SECRET=                   # Validates /api/cron/demo-reset requests
```

**Vercel Cron:**
```json
{
  "crons": [{ "path": "/api/cron/demo-reset", "schedule": "0 3 * * *" }]
}
```

### Decision Impact Analysis

**Implementation Sequence:**
1. DB migration (new tables + `household_id` on `recipes`)
2. `lib/auth/session.ts` — jose JWS sign/verify + cookie helpers
3. `lib/auth/join-code.ts` — join code generation
4. `lib/redis.ts` — Upstash Redis singleton (shared by rate limiting + revocation)
5. `middleware.ts` — replaces V1 stub; full auth gate + revocation check
6. `POST /api/households` — household creation + atomic V1 migration
7. `GET /api/households/lookup` + `POST /api/households/join` — join flows
8. `POST /api/demo/session` + `POST /api/cron/demo-reset` — demo mode
9. Landing screen + `(auth)/` route group + `LandingLayout`
10. `/join/[code]` invite link page
11. `GET /api/devices` + `DELETE /api/devices/[id]` — device management
12. `/household` page + all household management components

**Cross-Component Dependencies:**
- `SESSION_SIGNING_SECRET` → `lib/auth/session.ts` → consumed by `middleware.ts` + all auth API routes
- `middleware.ts` sets `x-household-id` header → consumed by all authenticated Server Components + Route Handlers
- `lib/redis.ts` → shared by `@upstash/ratelimit` (join endpoints) + revocation cache (middleware)
- `DEMO_HOUSEHOLD_ID` → `POST /api/demo/session` + `POST /api/cron/demo-reset`
- Atomic migration → runs once at first household creation, guarded by `household_id IS NULL` check

## Implementation Patterns & Consistency Rules — V1.5 Additions

**V1 patterns from `architecture.md` remain in force.** This section documents only the new conflict points introduced by the auth layer.

**New critical conflict points identified: 8 areas** where agents could make different choices for the auth system.

### Auth-Specific Naming Patterns

**New Table & Column Naming:**
- Tables: `households`, `device_sessions` — snake_case plural, consistent with V1 `recipes`
- ✅ `device_sessions.household_id` ❌ `device_sessions.householdId`
- ✅ `device_sessions.last_seen_at` ❌ `device_sessions.lastSeen`
- ✅ `households.join_code` ❌ `households.joinCode`, `households.code`
- ✅ `households.is_demo` ❌ `households.isDemo`

**New API Endpoint Naming:**
- ✅ `GET /api/households/lookup?code=WORD-NNNN` ❌ `/api/households/find`, `/api/households/search`
- ✅ `POST /api/households/join` ❌ `/api/households/member`, `/api/join`
- ✅ `DELETE /api/devices/[id]` ❌ `/api/devices/[id]/revoke`
- ✅ `DELETE /api/auth/session` ❌ `/api/logout`, `/api/auth/logout`

**New TypeScript Types (in `src/types/household.ts`):**
- `type Household = { id: string; name: string; joinCode: string; isDemo: boolean; createdAt: string }`
- `type DeviceSession = { id: string; householdId: string; deviceName: string; lastSeenAt: string; isRevoked: boolean }`
- `type SessionPayload = { hid: string; sid: string; iat: number }`

**New Component Subdirectories:**
- Auth components: `src/components/auth/`
- Household management: `src/components/household/`
- Demo: `src/components/demo/`

### Auth-Specific Structure Patterns

**Conflict Point 1 — Household ID source of truth:**
**Rule: Always read `x-household-id` from request headers — never parse the cookie directly in Route Handlers or Server Components.**

```ts
// ✅
import { headers } from 'next/headers'
const householdId = (await headers()).get('x-household-id')!

// ❌ Never re-parse the cookie
const cookie = (await cookies()).get('atable_session')
const payload = await verifySession(cookie?.value)
```

**Conflict Point 2 — Session utility centralization:**
**Rule: All session operations go through `src/lib/auth/session.ts` exclusively.**

`lib/auth/session.ts` is the ONLY file that imports `jose`, sets/clears `atable_session`, signs/verifies JWS tokens, or defines `SessionPayload`.

```ts
// ✅
import { createSession, clearSession } from '@/lib/auth/session'

// ❌ Never call jose directly outside lib/auth/session.ts
import { SignJWT } from 'jose'
```

**Conflict Point 3 — Redis client singleton:**
**Rule: Redis client lives in `src/lib/redis.ts` as a singleton. All operations import from there.**

```ts
// ✅ src/lib/redis.ts — defined once
export const redis = new Redis({ ... })
export const joinRateLimit = new Ratelimit({ redis, ... })

// ❌ Never instantiate Redis inline in a route handler
```

**Conflict Point 4 — Public vs protected route classification:**
**Rule: The definitive list of public routes lives in `middleware.ts` as a `PUBLIC_ROUTES` constant.**

New public routes are added to `PUBLIC_ROUTES` only. Route handlers do NOT check for session presence.

**Conflict Point 5 — Recipe queries must be household-scoped:**
**Rule: Every Supabase query on `recipes` MUST include `.eq('household_id', householdId)`.**

```ts
// ✅
const { data } = await supabase.from('recipes').select('*').eq('household_id', householdId)

// ❌ Never unscoped (exposes all households' data)
const { data } = await supabase.from('recipes').select('*')
```

Exception: the V1 atomic migration uses `WHERE household_id IS NULL` — the only legitimate unscoped mutation.

**Conflict Point 6 — Device name format:**
**Rule: Device names generated by `lib/auth/device-name.ts` only. Format: `"{Device} · {Browser}"` with `·` (U+00B7).**

```
✅ "iPhone 15 Pro · Safari"
✅ "Appareil inconnu · Chrome"   (fallback)
❌ "iPhone" / "Mobile Safari" / "iPhone - Safari"
```

**Conflict Point 7 — Cookie setting options:**
**Rule: `atable_session` cookie is ONLY set by `lib/auth/session.ts`. `sameSite: 'lax'` is load-bearing — changing it breaks `/join/[CODE]` from iOS external apps.**

**Conflict Point 8 — Demo household special-casing:**
**Rule: `is_demo` logic is isolated to 3 places: `POST /api/demo/session`, `POST /api/cron/demo-reset`, and the household menu display label. Everywhere else a demo session is treated identically to a real session.**

### Auth-Specific Format Patterns

**Session payload (canonical shape):**
```ts
type SessionPayload = { hid: string; sid: string; iat: number }
// ❌ Never add extra fields (name, email, role, isDemo)
```

**Join code format:**
- ✅ `OLIVE-4821` — uppercase WORD, hyphen, 4-digit zero-padded
- ❌ `olive-4821`, `OLIVE4821`, `OLIVE_4821`
- Validation regex: `/^[A-Z]+-\d{4}$/`

**Redis key namespaces:**
- Revocation: `revoked:{session_id}`
- Rate limiting: `rl:join:{ip}` (Upstash default prefix)

### Enforcement Guidelines — V1.5 Additions

**All AI Agents MUST:**
- Read household ID from `x-household-id` header, never re-parse the session cookie
- Use `lib/auth/session.ts` for all session operations — never import `jose` directly
- Use `lib/redis.ts` singleton — never instantiate Upstash Redis inline
- Scope all `recipes` queries to `household_id`
- Use `lib/auth/device-name.ts` for device name generation
- Add new public routes to `PUBLIC_ROUTES` in `middleware.ts` only

**Anti-Patterns to Avoid:**
- ❌ Parsing `atable_session` cookie in a Route Handler
- ❌ Calling `new SignJWT()` outside `lib/auth/session.ts`
- ❌ Instantiating `new Redis()` outside `lib/redis.ts`
- ❌ Querying `recipes` without `.eq('household_id', householdId)`
- ❌ Using `sameSite: 'strict'` on the session cookie
- ❌ Adding `is_demo` checks outside the 3 designated handlers
- ❌ Returning `401`/`403` for auth failures — always redirect to `/`

## Project Structure & Boundaries

### Complete Project Directory Structure

```
atable/
├── package.json
├── next.config.ts                    # existing — unchanged
├── tailwind.config.ts
├── tsconfig.json
├── components.json
├── vercel.json                       # NEW — Vercel Cron config
├── middleware.ts                     # MODIFIED — full auth gate replaces V1 stub
├── .env.local                        # gitignored — 5 new vars
├── .env.example                      # committed — updated with new var names
├── .gitignore
├── README.md
│
├── supabase/
│   └── migrations/
│       ├── 001_create_recipes.sql    # existing — unchanged
│       └── 002_household_auth.sql    # NEW — households, device_sessions, household_id on recipes
│
├── public/
│   └── placeholder.svg
│
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx                # MODIFIED — removes AppShell (moved to (app)/layout.tsx)
    │   ├── error.tsx
    │   ├── not-found.tsx
    │   │
    │   ├── (landing)/                # NEW route group — no nav, LandingLayout
    │   │   ├── layout.tsx            # LandingLayout wrapper (gradient bg, no nav)
    │   │   ├── page.tsx              # Landing screen (FR1) — public
    │   │   └── join/
    │   │       └── [code]/
    │   │           └── page.tsx      # Invite link confirmation (FR11, FR25) — public
    │   │
    │   ├── (app)/                    # Route group — authenticated, with nav
    │   │   ├── layout.tsx            # AppShell with nav (moved from root layout)
    │   │   │
    │   │   ├── home/                 # WAS (home)/ — URL changes from / to /home
    │   │   │   ├── page.tsx          # Home carousels (FR8–13) — Server Component
    │   │   │   └── loading.tsx
    │   │   │
    │   │   ├── library/              # unchanged
    │   │   │   ├── page.tsx
    │   │   │   └── loading.tsx
    │   │   │
    │   │   ├── recipes/              # unchanged
    │   │   │   ├── new/page.tsx
    │   │   │   └── [id]/
    │   │   │       ├── page.tsx
    │   │   │       ├── edit/page.tsx
    │   │   │       └── loading.tsx
    │   │   │
    │   │   └── household/            # NEW — household management menu
    │   │       ├── page.tsx          # Household menu (FR5–8, FR15–18) — Server Component shell
    │   │       └── loading.tsx
    │   │
    │   └── api/
    │       ├── recipes/              # unchanged
    │       │   ├── route.ts
    │       │   └── [id]/route.ts
    │       │
    │       ├── households/           # NEW
    │       │   ├── route.ts          # POST — create + atomic V1 migration (FR3, FR26)
    │       │   ├── lookup/route.ts   # GET — code preview (FR10, FR13)
    │       │   ├── join/route.ts     # POST — join by code (FR9, FR12, FR14)
    │       │   └── [id]/route.ts     # PUT rename (FR7) + DELETE leave (FR8)
    │       │
    │       ├── devices/              # NEW
    │       │   ├── route.ts          # GET — device list (FR15, FR18)
    │       │   └── [id]/route.ts     # DELETE — revoke (FR16, FR17)
    │       │
    │       ├── demo/session/route.ts # NEW — POST demo entry (FR19)
    │       ├── auth/session/route.ts # NEW — DELETE logout + demo exit (FR22)
    │       └── cron/demo-reset/route.ts # NEW — POST 24h reset (FR21)
    │
    ├── components/
    │   ├── ui/                       # unchanged — shadcn/ui primitives
    │   │
    │   ├── auth/                     # NEW — unauthenticated flow components
    │   │   ├── LandingScreen.tsx     # 3 CTAs + illustration + gradient — FR1
    │   │   ├── CreateHouseholdForm.tsx # Name input + submit — FR3
    │   │   ├── JoinConfirmation.tsx  # Pre-filled name + one-tap confirm — FR11
    │   │   ├── CodeEntryForm.tsx     # Format-validating input + preview — FR9, FR10
    │   │   ├── CodeEntryForm.test.tsx
    │   │   └── PostCreationBanner.tsx # Code + copy after creation — FR4, FR5
    │   │
    │   ├── household/                # NEW — household management
    │   │   ├── CodeDisplay.tsx       # OLIVE-4821 with copy — FR5
    │   │   ├── InviteLinkDisplay.tsx # Full URL with copy — FR6
    │   │   ├── DeviceListItem.tsx    # Device + last-seen + revoke — FR15, FR16, FR18
    │   │   ├── DeviceListItem.test.tsx
    │   │   ├── InlineEditableField.tsx # Text → input on pencil tap — FR7
    │   │   └── HouseholdMenuContent.tsx # Composed menu sections
    │   │
    │   ├── demo/
    │   │   └── DemoBanner.tsx        # Persistent "Quitter la démo" — FR22
    │   │
    │   ├── recipes/                  # unchanged
    │   └── layout/                   # unchanged
    │
    ├── lib/
    │   ├── auth/                     # NEW — auth utilities (server-side only)
    │   │   ├── session.ts            # jose JWS sign/verify + cookie helpers + SessionPayload type
    │   │   ├── session.test.ts
    │   │   ├── join-code.ts          # WORD-NNNN generation from food word list
    │   │   ├── join-code.test.ts
    │   │   └── device-name.ts        # bowser UA → "iPhone 15 · Safari"
    │   │
    │   ├── redis.ts                  # NEW — Upstash Redis singleton + joinRateLimit
    │   ├── schemas/
    │   │   ├── recipe.ts             # unchanged
    │   │   └── household.ts          # NEW — HouseholdCreateSchema, JoinCodeSchema
    │   ├── supabase/                 # unchanged
    │   ├── i18n/fr.ts                # MODIFIED — add auth/household strings
    │   └── utils.ts                  # unchanged
    │
    ├── hooks/                        # unchanged V1 hooks
    └── types/
        ├── recipe.ts                 # unchanged
        ├── api.ts                    # unchanged
        └── household.ts              # NEW — Household, DeviceSession, SessionPayload types
```

### Architectural Boundaries

**Auth boundary:**
- `middleware.ts` → validates every authenticated request
- `lib/auth/session.ts` → sole owner of jose + cookie operations
- `lib/redis.ts` → sole owner of Upstash Redis
- `api/households/route.ts` (POST) → sole owner of V1 atomic migration

**Server / Client boundary — new components:**

| Always Server Component | Always Client Component |
|---|---|
| `(landing)/page.tsx` | `LandingScreen.tsx` |
| `(landing)/join/[code]/page.tsx` | `CreateHouseholdForm.tsx` |
| `(app)/home/page.tsx` | `JoinConfirmation.tsx` |
| `(app)/household/page.tsx` | `CodeEntryForm.tsx` |
| | `CodeDisplay.tsx`, `InviteLinkDisplay.tsx` |
| | `DeviceListItem.tsx`, `DemoBanner.tsx` |
| | `InlineEditableField.tsx` |

**Demo boundary:**
- `POST /api/demo/session` → creates demo session
- `POST /api/cron/demo-reset` → resets demo recipes
- No other file references `is_demo` for logic

### Requirements to Structure Mapping

| FR Group | Responsible Files |
|---|---|
| Onboarding & Entry (FR1–2) | `(landing)/page.tsx`, `LandingScreen.tsx`, `middleware.ts` |
| Household Management (FR3–8) | `api/households/route.ts`, `api/households/[id]/route.ts`, `(app)/household/page.tsx`, `HouseholdMenuContent.tsx` |
| Joining a Household (FR9–13) | `api/households/lookup/route.ts`, `api/households/join/route.ts`, `CodeEntryForm.tsx`, `JoinConfirmation.tsx`, `lib/redis.ts` |
| Session & Device Management (FR14–18) | `api/devices/route.ts`, `api/devices/[id]/route.ts`, `lib/auth/session.ts`, `DeviceListItem.tsx`, `middleware.ts` |
| Demo Mode (FR19–23) | `api/demo/session/route.ts`, `api/cron/demo-reset/route.ts`, `api/auth/session/route.ts`, `DemoBanner.tsx` |
| Auth Gate (FR24–25) | `middleware.ts`, `(landing)/join/[code]/page.tsx` |
| Data Migration (FR26–27) | `api/households/route.ts` (atomic tx), `supabase/migrations/002_household_auth.sql` |

### Data Flow

**Authenticated request flow:**
```
Request → middleware.ts (JWS verify + Redis revocation check)
  → set x-household-id, x-session-id headers
  → Route Handler reads householdId from headers
  → Supabase query scoped to .eq('household_id', householdId)
  → response
```

**Household creation + V1 migration:**
```
POST /api/households { name }
  → Zod validation → generate WORD-NNNN code
  → BEGIN TRANSACTION
      INSERT INTO households
      INSERT INTO device_sessions
      UPDATE recipes SET household_id = $1 WHERE household_id IS NULL
  → COMMIT (or full ROLLBACK on any failure)
  → lib/auth/session.ts: sign JWS { hid, sid } → set cookie → redirect /home
```

**Device revocation:**
```
DELETE /api/devices/[id]
  → verify device belongs to current household
  → UPDATE device_sessions SET is_revoked = true
  → Redis SET revoked:{sid} 1 EX 31536000
  → next request from revoked device: middleware Redis check → redirect to /
```

### External Integrations

| Service | Integration Point | Purpose |
|---|---|---|
| Supabase PostgreSQL | `lib/supabase/server.ts` (unchanged) | All DB including new auth tables |
| Upstash Redis | `lib/redis.ts` | Rate limiting + revocation cache |
| Vercel Edge | `middleware.ts` | Auth gate on every request |
| Vercel Cron | `vercel.json` + `/api/cron/demo-reset` | 24h demo data reset |
| `jose` (npm) | `lib/auth/session.ts` | JWS cookie signing/verification |
| `bowser` (npm) | `lib/auth/device-name.ts` | UA → human-readable device name |

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices are natively compatible.
- `jose` v6.x uses Web Crypto API internally — works in Next.js Edge Runtime middleware with no configuration.
- `@upstash/ratelimit` communicates via REST API — Edge Runtime compatible, no Node.js dependencies.
- `bowser` runs in Node.js Route Handlers (session creation), never in Edge middleware — correct placement.
- `sameSite: 'lax'` on the session cookie is architecturally paired with `/join/[code]` opening from external iOS apps — correct.
- Upstash Redis serves dual purpose (rate limiting + revocation cache) from a single `lib/redis.ts` singleton — different key namespaces, no conflict.

**Pattern Consistency:** All naming conventions extend V1 without contradiction. Error format `{ error: string }` applies uniformly to all new route handlers. `x-household-id` header propagation provides a single source of truth for household context across all authenticated components.

**Structure Alignment:** Route group split `(landing)` / `(app)` cleanly maps the auth boundary to layout concerns. `lib/auth/` isolates all auth utilities. The `(app)/home/` path change (`/` → `/home`) is the only URL structure change from V1.

### Requirements Coverage Validation ✅

**All 27 Functional Requirements covered:**

| FR | Coverage |
|---|---|
| FR1 | `(landing)/page.tsx` + `LandingScreen.tsx` — 3 options |
| FR2 | `middleware.ts` PUBLIC_ROUTES gate |
| FR3 | `POST /api/households` + `CreateHouseholdForm.tsx` |
| FR4 | `lib/auth/join-code.ts` → WORD-NNNN auto-generation |
| FR5 | `CodeDisplay.tsx` in household menu |
| FR6 | `InviteLinkDisplay.tsx` in household menu |
| FR7 | `PUT /api/households/[id]` + `InlineEditableField.tsx` |
| FR8 | `DELETE /api/households/[id]` with last-member cascade deletion |
| FR9 | `CodeEntryForm.tsx` + `POST /api/households/join` |
| FR10 | `GET /api/households/lookup` — household name preview |
| FR11 | `(landing)/join/[code]/page.tsx` + `JoinConfirmation.tsx` |
| FR12 | Redis sliding window 5/hr/IP on lookup + join endpoints |
| FR13 | `{ error: 'Ce code ne correspond à aucun foyer' }` from lookup |
| FR14 | `lib/auth/session.ts` → ~1yr httpOnly cookie on join/create |
| FR15 | `GET /api/devices` + `DeviceListItem.tsx` |
| FR16 | `DELETE /api/devices/[id]` |
| FR17 | Redis `SET revoked:{sid}` → immediate next-request invalidation |
| FR18 | `lib/auth/device-name.ts` (bowser) called at session creation |
| FR19 | `POST /api/demo/session` → full V1 experience via demo household |
| FR20 | `supabase/seed.sql` (Gap 3) + Cron reset |
| FR21 | Vercel Cron `0 3 * * *` → `POST /api/cron/demo-reset` |
| FR22 | `DemoBanner.tsx` + `DELETE /api/auth/session` → landing redirect |
| FR23 | Demo session → demo household; new household creation is separate |
| FR24 | `middleware.ts` PUBLIC_ROUTES — all others gated |
| FR25 | `(landing)/join/[code]/page.tsx` in PUBLIC_ROUTES; household name fetched server-side |
| FR26 | Atomic UPDATE in `POST /api/households` transaction |
| FR27 | All V1 recipes preserved; `household_id` assigned atomically |

**All 15 NFRs covered:**

| NFR Category | Architectural Coverage |
|---|---|
| Performance (P1–P5) | Middleware: JWS verify + Redis GET (<10ms, no DB); landing is static; auth flows are single DB ops; V1 routes unchanged |
| Security (S1–S5) | Cookie spec fully documented; signed-not-encrypted payload (hid+sid+iat only); Upstash rate limiting; Redis revocation; V1 security baseline unchanged |
| Reliability (R1–R4) | Atomic migration with full rollback; ON DELETE CASCADE prevents orphaned rows; cron failure non-blocking; all auth failures → clean redirect to `/` |
| Accessibility (A1–A3) | V1 design system + WCAG 2.1 AA inherited; UX spec documents all new aria attributes and keyboard tab order |

### Gap Analysis — 4 Items Resolved

**Gap 1 (Critical) — V1 recipe route handlers need household scoping: RESOLVE FIRST**

V1's `api/recipes/route.ts` and `api/recipes/[id]/route.ts` query recipes without `household_id` filter. After V1.5 they MUST add:
```ts
const householdId = (await headers()).get('x-household-id')!
// All queries: .eq('household_id', householdId)
```
These routes are now inside `(app)/` so middleware guarantees `x-household-id` is always present.

**Gap 2 (Critical) — Navigation home link + authenticated `/` redirect: RESOLVE WITH LANDING SCREEN**

- `Navigation.tsx`: update home link from `href="/"` → `href="/home"`
- `middleware.ts`: add redirect for authenticated users landing on `/`:
```ts
if (pathname === '/' && sessionIsValid) {
  return NextResponse.redirect(new URL('/home', request.url))
}
```

**Gap 3 (Important) — Demo seed data setup: RESOLVE BEFORE DEPLOY**

Add `supabase/seed.sql` — creates the demo household row + seeds ~10 recipes with `household_id = DEMO_HOUSEHOLD_ID`. `DEMO_HOUSEHOLD_ID` env var is populated after running seed. `/api/cron/demo-reset` restores to this seed state every 24h.

**Gap 4 (Important) — `revalidatePath` on household mutations: RESOLVE INLINE**

- `PUT /api/households/[id]` → `revalidatePath('/household')`
- `DELETE /api/devices/[id]` → `revalidatePath('/household')`
- `DELETE /api/households/[id]` → `revalidatePath('/')` (redirects to landing anyway)

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed (27 FRs, 15 NFRs)
- [x] Scale and complexity assessed (Low-Medium; atomic migration is primary risk)
- [x] Technical constraints identified (iOS Safari, brownfield, custom auth)
- [x] Cross-cutting concerns mapped (8 identified and addressed)

**Architectural Decisions**
- [x] Critical decisions documented with package versions (jose v6.1.3, @upstash/ratelimit v2.0.8, bowser v2.14.1)
- [x] Auth approach fully specified (JWS-signed cookie, Redis revocation, no third-party provider)
- [x] Integration patterns defined (middleware headers, Redis namespacing, atomic migration)
- [x] Performance and reliability considerations addressed per NFR

**Implementation Patterns**
- [x] Naming conventions established (new tables, routes, TypeScript types)
- [x] Structure patterns defined (8 conflict points with explicit rules and examples)
- [x] Auth-specific anti-patterns documented
- [x] Process patterns documented (session failure → landing, atomic migration rollback)

**Project Structure**
- [x] Complete directory structure defined (all new files named explicitly)
- [x] Component boundaries established (server/client split, demo isolation, auth boundary)
- [x] Integration points mapped (Supabase, Upstash, Vercel Cron, jose, bowser)
- [x] All 27 FRs mapped to specific files and directories

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: High**

**Key Strengths:**
- Custom cookie auth is fully specified — no implementation ambiguity, no third-party provider complexity
- Upstash Redis serves dual purpose (rate limiting + revocation) from a single client — activated from V1 stub
- Atomic V1 migration is the highest-risk operation and the most thoroughly documented
- All 27 FRs traced to specific files — zero guesswork about where new code lives
- Redis revocation cache resolves the NFR-P1 (<10ms) vs FR17 (immediate invalidation) tension cleanly

**Areas for Future Enhancement (Full V2):**
- Session sliding window renewal (auto-extend ~1yr sessions on activity)
- Replace `DEMO_HOUSEHOLD_ID` env var with a DB-level `WHERE is_demo = true` query (more robust)
- Evaluate Upstash connection pooling if household count grows significantly

### Implementation Handoff

**AI Agent Guidelines:**
- Implement in the sequence defined in Decision Impact Analysis (steps 1–12)
- Resolve Gap 1 (recipe route scoping) when touching recipe routes — do not defer
- Resolve Gap 2 (Navigation + middleware redirect) alongside the landing screen
- Resolve Gap 3 (seed.sql) before deploying — demo mode is broken without it
- Resolve Gap 4 (revalidatePath) when implementing household management handlers
- All V1 patterns from `architecture.md` remain in force for recipe functionality

**First Implementation Story:** DB schema migration (`supabase/migrations/002_household_auth.sql`) + auth utilities (`lib/auth/session.ts`, `lib/auth/join-code.ts`, `lib/redis.ts`)
