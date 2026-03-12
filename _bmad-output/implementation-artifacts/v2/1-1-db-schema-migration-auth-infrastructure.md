# Story 1.1: DB Schema Migration & Auth Infrastructure

Status: done

## Story

As a developer deploying atable v1.5,
I want the database schema extended with household and device tables, and core auth utilities in place,
So that all subsequent auth features have a reliable technical foundation to build on.

## Acceptance Criteria

1. **Given** a Supabase project with the V1 schema **When** migration `002_household_auth.sql` is applied **Then** the `households` table exists with: `id` (UUID PK), `name` (TEXT NOT NULL), `join_code` (TEXT NOT NULL UNIQUE), `is_demo` (BOOLEAN NOT NULL DEFAULT false), `created_at` (TIMESTAMPTZ DEFAULT NOW())
2. **Given** migration applied **Then** the `device_sessions` table exists with: `id` (UUID PK), `household_id` (UUID FK → households ON DELETE CASCADE), `device_name` (TEXT NOT NULL), `last_seen_at` (TIMESTAMPTZ DEFAULT NOW()), `created_at` (TIMESTAMPTZ DEFAULT NOW()), `is_revoked` (BOOLEAN NOT NULL DEFAULT false)
3. **Given** migration applied **Then** indexes exist on `device_sessions(household_id)` and `recipes(household_id)`
4. **Given** migration applied **Then** the `recipes` table has a nullable `household_id` column (UUID FK → households ON DELETE SET NULL)
5. **Given** `lib/auth/session.ts` **When** imported **Then** it exports `signSession(payload: SessionPayload)`, `verifySession(token: string)`, `setSessionCookie(response, payload)`, `clearSessionCookie(response)`, and the `SessionPayload` type `{ hid: string; sid: string; iat: number }`
6. **Given** `lib/auth/session.ts` **Then** it is the ONLY file in the codebase that imports `jose` directly
7. **Given** `lib/auth/join-code.ts` **When** `generateJoinCode()` is called **Then** it returns a string matching `/^[A-Z]+-\d{4}$/` (e.g. `OLIVE-4821`) drawn from a curated food/kitchen word list
8. **Given** `lib/auth/device-name.ts` **When** `getDeviceName(userAgent: string)` is called **Then** it returns a string in the format `"{Device} · {Browser}"` using U+00B7 middle dot (e.g. `"iPhone 15 Pro · Safari"`) **And** for unknown/empty UAs it returns `"Appareil inconnu · Navigateur inconnu"` or a partial fallback
9. **Given** `lib/redis.ts` **When** imported **Then** it exports a singleton Upstash Redis client and a `joinRateLimit` Ratelimit instance (5 requests/hour sliding window) **And** it is the ONLY file that instantiates `new Redis()`
10. **Given** `src/types/household.ts` **When** imported **Then** it exports `Household`, `DeviceSession`, and `SessionPayload` types matching the architecture spec
11. **Given** `lib/schemas/household.ts` **When** imported **Then** it exports `HouseholdCreateSchema` (non-empty string, max 50 chars) and `JoinCodeSchema` (regex `/^[A-Z]+-\d{4}$/`)

## Tasks / Subtasks

- [x] Install new dependencies (AC: all)
  - [x] `npm install jose@^6.1.3 @upstash/ratelimit@^2.0.8 bowser@^2.14.1`
  - [x] Verify `bowser` has TypeScript types (it does, built-in)
- [x] Create DB migration `supabase/migrations/002_household_auth.sql` (AC: 1–4)
  - [x] CREATE TABLE households (id, name, join_code UNIQUE, is_demo, created_at)
  - [x] CREATE TABLE device_sessions (id, household_id FK CASCADE, device_name, last_seen_at, created_at, is_revoked)
  - [x] CREATE INDEX ON device_sessions(household_id)
  - [x] ALTER TABLE recipes ADD COLUMN household_id UUID FK → households ON DELETE SET NULL
  - [x] CREATE INDEX ON recipes(household_id)
- [x] Create `src/types/household.ts` (AC: 10)
  - [x] Export Household, DeviceSession, SessionPayload types — camelCase only
- [x] Create `src/lib/schemas/household.ts` (AC: 11)
  - [x] HouseholdCreateSchema: z.string().min(1).max(50)
  - [x] JoinCodeSchema: z.string().regex(/^[A-Z]+-\d{4}$/)
- [x] Create `src/lib/auth/session.ts` (AC: 5–6)
  - [x] Import jose (only this file does so)
  - [x] Implement signSession, verifySession using HS256 + SESSION_SIGNING_SECRET
  - [x] Implement setSessionCookie and clearSessionCookie with correct cookie spec
  - [x] Export SessionPayload type `{ hid: string; sid: string; iat: number }`
  - [x] Write `src/lib/auth/session.test.ts`
- [x] Create `src/lib/auth/join-code.ts` (AC: 7)
  - [x] Define food/kitchen word list (~50 words: OLIVE, THYME, CUMIN, BASIL, FENNEL, CAPER, ANISE, SORREL, CUMIN, SAGE, MISO, etc.)
  - [x] generateJoinCode(): pick random word + random 4-digit number, format WORD-NNNN
  - [x] Write `src/lib/auth/join-code.test.ts`
- [x] Create `src/lib/auth/device-name.ts` (AC: 8)
  - [x] Import bowser; parse UA string to get device type + browser name
  - [x] Format: `"{Device} · {Browser}"` with U+00B7
  - [x] Fallback: `"Appareil inconnu · Navigateur inconnu"` or partial fallback if one part is known
- [x] Create `src/lib/redis.ts` (AC: 9)
  - [x] Import Redis from @upstash/redis and Ratelimit from @upstash/ratelimit
  - [x] Export singleton `redis = new Redis({ url, token })`
  - [x] Export `joinRateLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h') })`
- [x] Update `.env.example` with new required vars
  - [x] UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, SESSION_SIGNING_SECRET, DEMO_HOUSEHOLD_ID, CRON_SECRET

## Dev Notes

### Architecture Constraints (CRITICAL)

**Session utility centralization:**
- `lib/auth/session.ts` is the ONLY file that imports `jose`. All other files use its exported functions.
- Cookie spec MUST be: `httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, path: '/'`
- `sameSite: 'lax'` is LOAD-BEARING — changing to `'strict'` breaks `/join/[CODE]` from iOS external apps (SMS/WhatsApp/iMessage)

**Redis singleton:**
- `lib/redis.ts` is the ONLY file that instantiates `new Redis()`. Never inline in route handlers.
- Redis serves two purposes from the same instance: rate limiting (key prefix `rl:`) and revocation cache (key prefix `revoked:`)
- Upstash client uses REST API, not raw TCP — compatible with Edge Runtime and Serverless functions

**SessionPayload shape is canonical:**
```ts
type SessionPayload = { hid: string; sid: string; iat: number }
// NEVER add extra fields (name, email, role, isDemo, etc.)
```

**Cookie name:** `atable_session` — do not deviate.

**Join code format:**
- Must match `/^[A-Z]+-\d{4}$/`
- Use food/kitchen words: OLIVE, THYME, CUMIN, ANISE, BASIL, FENNEL, CAPER, SORREL, SAGE, MISO, DASHI, SUMAC, TAHINI, SAFFRON, PAPRIKA, CARAWAY, CHIVE, CLOVE, CURRY, FARRO, GHEE, JUNIPER, KOMBU, LEMON, MAPLE, NETTLE, ORZO, PANKO, QUINCE, RAMEN, SOBA, TAMARI, UMAMI, VADOUVAN, WALNUT, YUZU, etc.
- Zero-pad the number to 4 digits: `OLIVE-0042` not `OLIVE-42`

**Device name format:**
- Format: `"{Device} · {Browser}"` — the separator is U+00B7 (middle dot), NOT a regular hyphen or dash
- bowser v2.x API: `Bowser.parse(ua)` returns `{ browser: { name }, os: { name }, platform: { type }, … }`
- Fallback for unknown: `"Appareil inconnu · Navigateur inconnu"`

### Project Structure — New Files

```
supabase/migrations/002_household_auth.sql     ← NEW
src/types/household.ts                         ← NEW
src/lib/auth/session.ts                        ← NEW (only jose importer)
src/lib/auth/session.test.ts                   ← NEW
src/lib/auth/join-code.ts                      ← NEW
src/lib/auth/join-code.test.ts                 ← NEW
src/lib/auth/device-name.ts                    ← NEW (bowser importer)
src/lib/redis.ts                               ← NEW (only Redis instantiator)
src/lib/schemas/household.ts                   ← NEW
.env.example                                   ← MODIFIED (add 5 new vars)
```

### Session Signing Implementation Notes

- Use `jose` HS256 algorithm (compact JWS)
- `signSession`: create JWS with HS256, include iat automatically
- `verifySession`: catch all errors and return null (never throw) — callers treat null as invalid session
- `SESSION_SIGNING_SECRET` must be at least 32 chars — document in `.env.example`

```ts
// Session payload shape
const payload: SessionPayload = { hid: householdId, sid: sessionId, iat: Date.now() }

// Cookie options (exact spec — do not change sameSite)
const cookieOptions = {
  name: 'atable_session',
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 365,
  path: '/'
}
```

### V1 Architecture Patterns Still in Force

- Supabase client from `lib/supabase/server.ts` — unchanged
- Types use camelCase (DB uses snake_case; mapDbRowToRecipe handles the mapping)
- All new DB types must also go through camelCase mapping when used in TypeScript
- Zod schemas in `lib/schemas/` directory

### References

- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Data Architecture`
- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#New Dependencies for V1.5`
- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Conflict Point 2 — Session utility centralization`
- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Conflict Point 3 — Redis client singleton`
- Epics: `_bmad-output/planning-artifacts/epics-v2.md#Story 1.1`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Installed `jose@^6.1.3`, `@upstash/ratelimit@^2.0.8`, `@upstash/redis`, `bowser@^2.14.1`
- Created `002_household_auth.sql` migration with households, device_sessions tables and indexes
- `src/lib/auth/session.ts` is the only jose importer; uses HS256 JWS with exact cookie spec
- `src/lib/redis.ts` is the only Redis instantiator; exports singleton + joinRateLimit
- 11 new tests passing (7 session, 4 join-code)
- Pre-existing RecipeCard test failure confirmed unrelated to this story

### File List

- supabase/migrations/002_household_auth.sql (new)
- src/types/household.ts (new)
- src/lib/schemas/household.ts (new)
- src/lib/auth/session.ts (new)
- src/lib/auth/session.test.ts (new)
- src/lib/auth/join-code.ts (new)
- src/lib/auth/join-code.test.ts (new)
- src/lib/auth/device-name.ts (new)
- src/lib/redis.ts (new)
- .env.example (modified)
- package.json (modified)
- package-lock.json (modified)

### Change Log

- 2026-03-02: Implemented Story 1.1 — DB schema migration + auth infrastructure (jose session signing, join code generator, device name parser, Redis singleton, Supabase migration)
