---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-01'
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-atable-2026-02-28.md"
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
workflowType: 'architecture'
project_name: 'atable'
user_name: 'Anthony'
date: '2026-03-01'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (38 FRs across 8 capability areas):**

- **Recipe Management (FR1–7):** Full CRUD with a permissive model — title is the only required field, all others optional forever. No draft states, no visual penalty for incomplete recipes. Incomplete ≠ broken.
- **Content Discovery (FR8–13):** Thematic carousels driven by manual tags, horizontal scroll, single-tap recipe open with no intermediate screen, immediate home screen render.
- **Recipe Capture (FR14–17):** Auto-focused title field on form open, save enabled immediately on any title content, confirmation toast + return to home, recipe appears in library instantly.
- **Recipe Reading (FR18–21):** Single continuous scroll (no pagination), Wake Lock API to prevent screen dimming, conditional rendering of ingredient/step sections (only when content exists).
- **Search & Retrieval (FR22–26):** Real-time per-keystroke search across title + ingredients + tags simultaneously, no submit action, warm empty state for zero results.
- **Media Management (FR27–30):** Photo from camera/gallery, replace/remove, warm placeholder for photoless recipes — photoless recipes are first-class citizens in all views.
- **Responsive Experience (FR31–33):** Mobile bottom nav bar; tablet/desktop side nav rail + expanded layouts. Two genuine layout modes, not just reflow.
- **System & Security (FR34–38):** Rate limiting on all writes, cross-device sync, 44px touch targets, WCAG 2.1 AA contrast, keyboard navigation.

**Non-Functional Requirements:**

| Category | Key Requirements |
|---|---|
| **Performance** | Home screen ≤1.5s; Recipe detail ≤1s incl. image; Search ≤100ms/keystroke; Save ≤500ms; Skeleton only if load >150ms; Photo upload async/non-blocking |
| **Security** | Rate limiting on all write endpoints; HTTPS (Vercel default); encrypted at rest (Supabase default); storage paths namespaced by session token |
| **Accessibility** | WCAG 2.1 AA (4.5:1 body, 3:1 large text); 44×44px touch targets; keyboard nav; `lang="fr"`; `prefers-reduced-motion` respected; eslint-plugin-jsx-a11y blocks builds on violations |
| **Reliability** | No silent data loss — failed saves surface explicit errors; photo upload failure non-cascading; cross-device sync ≤1s; Wake Lock failure silent/graceful |

**Scale & Complexity:**

- Primary domain: Full-stack web (Next.js App Router + Vercel + Supabase)
- Complexity level: **Low** — standard CRUD, no real-time collaboration, no auth in V1
- Estimated architectural components: ~6 (routing/pages, API routes, DB layer, storage, search, image pipeline)

### Technical Constraints & Dependencies

- **Tech stack fixed in PRD:** Next.js (App Router), Tailwind CSS, shadcn/ui, Supabase (PostgreSQL + object storage), Vercel
- **Browser target:** iOS Safari (iPhone + iPad) as primary critical surface — Wake Lock, Web Share API, safe area insets, no custom PWA install prompt
- **Responsive breakpoints:** Default (mobile), `md` (768px, minor card refinement only), `lg` (1024px, genuine layout mode switch)
- **Language:** French UI — `lang="fr"` declared on HTML, all UI strings in French
- **No auth in V1** — app is private by URL obscurity; API protection via rate limiting only
- **V2 readiness constraints enforced in V1:**
  - `user_id` FK on recipes table from day one
  - Photo storage paths namespaced by session/device token
  - API routes structured for future auth middleware insertion without data ownership refactor

### Cross-Cutting Concerns Identified

1. **Performance at multiple layers** — client-side search (100ms budget), image optimization pipeline (WebP/AVIF, next/image, blur placeholder, no layout shift), skeleton loading threshold (150ms)
2. **Async photo handling** — optimistic UI (recipe saves first), async upload, explicit error surface on failure, storage path namespacing
3. **Responsive layout architecture** — single codebase, two genuine layout modes (bottom nav / side rail), all primary flows work on both
4. **V2 readiness** — schema design, storage structure, and API surface must not require breaking changes when auth lands
5. **Accessibility** — WCAG AA enforced at build time via eslint-plugin-jsx-a11y, not aspirational
6. **Rate limiting** — must protect all write endpoints from launch; no auth layer means this is the primary abuse prevention mechanism
7. **French language** — UI strings, HTML lang attribute, locale-aware formatting throughout

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application — tech stack pre-confirmed in PRD.

### Selected Starter: `create-next-app@latest` + `shadcn@latest init`

**Rationale:** Stack explicitly defined in PRD. `create-next-app` with recommended defaults is the official, maintained, Vercel-optimized path. shadcn/ui is initialized as a second step since it layers on top of the Next.js scaffold.

**Initialization Commands:**

```bash
npx create-next-app@latest atable \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

npx shadcn@latest init
```

**Architectural Decisions Provided by Starter:**

| Concern | Decision |
|---|---|
| **Language & Runtime** | TypeScript, Node.js runtime via Vercel |
| **Styling Solution** | Tailwind CSS v4 + shadcn/ui CSS variables — utility-first with composable component layer |
| **Build Tooling** | Turbopack (dev HMR), Next.js optimized bundler (prod) |
| **Testing Framework** | Not included — Vitest + Testing Library to be added |
| **Code Organization** | `src/` directory, App Router conventions, `@/*` alias for clean imports |
| **Development Experience** | Fast refresh, TypeScript checking, ESLint, Vercel preview deploys on push |
| **Images** | `next/image` — WebP/AVIF, lazy load, blur placeholder, no layout shift |

**Note:** Project initialization using these commands should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Data validation strategy — Zod v4
- Data fetching / state management — Next.js RSC native
- Server vs Client component split — defined below
- Storage namespacing — device token from day one (V2 readiness)

**Important Decisions (Shape Architecture):**
- Rate limiting approach — Vercel edge + middleware (V1)
- Search implementation — client-side in-memory filtering

**Deferred Decisions (Post-MVP):**
- Upstash Redis rate limiting — upgrade if abuse observed in V2
- TanStack Query — evaluate if data complexity grows significantly
- Authentication — V2

### Data Architecture

**Data Validation: Zod v4 (v4.3.6)**
- Rationale: TypeScript-first, single schema shared across server (route handler validation) and client (form validation). 14× faster than v3, smaller bundle. Native fit with the Next.js + TypeScript stack.
- Usage: One `lib/schemas/recipe.ts` schema file drives both API validation and client form types.
- Cascading: All route handlers validate incoming payloads through Zod before touching the database.

**Database: Supabase (PostgreSQL) — V2-Ready Schema**
- `recipes` table includes `user_id` UUID column from day one (nullable in V1, required in V2).
- No breaking migration when auth lands — column exists, constraint is added.
- Supabase client initialized in `lib/supabase/` with separate server and browser clients.

**Photo Storage Namespacing (V2 Readiness):**
- On first app load, generate `crypto.randomUUID()` and persist in `localStorage` as `atable_device_token`.
- All Supabase storage uploads use path: `/{deviceToken}/{recipeId}/photo.webp`
- When V2 auth lands: device token is replaced by `user_id` — same path structure, no storage migration.

### Authentication & Security

**V1: No Authentication**
- App is private by URL obscurity in V1. No login, no sessions.
- Decision: Explicitly accepted risk. V1 is a household-only product.

**Rate Limiting: Vercel Edge Protection + Next.js Middleware (V1)**
- V1 approach: Rely on Vercel's built-in edge DDoS protection + a Next.js middleware layer that validates request structure and adds rate-limit response headers.
- Honest caveat: True per-IP sliding window rate limiting requires persistent storage (Redis). Without it, V1 protection is best-effort.
- Upgrade path: Add `@upstash/ratelimit` + Upstash Redis in a single middleware file if abuse is observed. No other code changes needed.
- Affects: `middleware.ts` at project root — intercepts all `/api/*` write routes (POST, PUT, PATCH, DELETE).

### API & Communication Patterns

**API Design: Next.js Route Handlers (REST-style)**
- All data operations go through `app/api/recipes/` route handlers.
- Standard REST verbs: `GET /api/recipes`, `POST /api/recipes`, `GET /api/recipes/[id]`, `PUT /api/recipes/[id]`, `DELETE /api/recipes/[id]`.
- Route handlers are the insertion point for future auth middleware (V2) — adding an auth check is one line per handler, not a data refactor.

**Error Handling Standard:**
- All route handlers return consistent JSON error shape: `{ error: string, code?: string }`.
- Client surfaces errors explicitly — no silent failures (NFR-R1, NFR-R2).
- Zod validation errors translated to user-friendly messages before returning.

**Cache Invalidation: `revalidatePath`**
- After any mutation (create, update, delete), the route handler calls `revalidatePath('/') ` and `revalidatePath('/recipes/[id]')` to invalidate Next.js cache.
- Cross-device sync falls naturally: next page load fetches fresh data from Supabase.

### Frontend Architecture

**Server vs Client Component Strategy:**

| Component | Type | Rationale |
|---|---|---|
| Home screen (carousels) | Server Component | Data fetched on server; no client interactivity |
| Recipe detail view | Server Component | Static read; Wake Lock is a `'use client'` island |
| Library / grid view | Server Component | Fetched on server |
| Search UI | Client Component | Keystroke state, in-memory filtering |
| Capture / edit form | Client Component | Form state, auto-focus, optimistic save |
| Wake Lock hook | Client Component | Browser API (`navigator.wakeLock`) |
| Navigation bar / rail | Client Component | Active route highlighting |

**State Management: Next.js Native (no external library)**
- Server Components own data fetching — no client state library needed.
- Client Components use `useState` / `useReducer` for local UI state.
- After mutations: Server Actions or route handler calls `revalidatePath` to refresh server data.
- Rationale: TanStack Query / SWR adds complexity that this CRUD app's scale doesn't justify in V1.

**Search: Client-Side In-Memory Filtering**
- All recipes fetched on home screen load (already needed for carousels).
- Search UI filters the in-memory array on every keystroke — no additional network requests.
- 100ms budget easily met for a household library (<500 recipes). No debounce needed.
- Implementation: `useMemo` over the recipes array, filtered by `title + ingredients + tags`.

**Photo Upload: Optimistic UI + Async**
- Recipe is saved to DB immediately (title-only if needed) — save never waits for photo upload.
- Photo uploads to Supabase storage asynchronously after save completes.
- Upload failure: surfaces an explicit dismissible error toast; recipe remains accessible.
- `next/image` handles all delivery: WebP/AVIF format, sized to device, blur placeholder.

### Infrastructure & Deployment

**Hosting: Vercel**
- Auto-deploys on push to `main`. Preview deploys on pull requests.
- Environment variables managed in Vercel dashboard + `.env.local` for development.

**Environment Configuration:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never exposed to client
```

**CI/CD: Vercel (automatic)**
- No separate CI pipeline needed for V1.
- `eslint-plugin-jsx-a11y` runs in build — fails deploy on accessibility violations.

### Decision Impact Analysis

**Implementation Sequence:**
1. Project scaffold (`create-next-app` + `shadcn@latest init`)
2. Supabase project setup + schema migration (recipes table with `user_id` FK nullable)
3. Environment variables configured locally + on Vercel
4. Zod schema (`lib/schemas/recipe.ts`)
5. Supabase client setup (`lib/supabase/server.ts` + `lib/supabase/client.ts`)
6. API route handlers with Zod validation
7. Next.js middleware (rate limiting shell, ready for Upstash upgrade)
8. Server Components (home, detail, library)
9. Client Components (search, form, Wake Lock, navigation)
10. Photo upload flow (optimistic save → async Supabase storage)

**Cross-Component Dependencies:**
- Zod schema → used by route handlers (server) AND form validation (client) — single source of truth
- Device token → generated by navigation/app shell on mount → consumed by photo upload handler
- `revalidatePath` → called in route handlers → invalidates Server Component cache → cross-device sync
- Middleware → wraps all `/api/*` routes → auth insertion point in V2

## Implementation Patterns & Consistency Rules

**Critical conflict points identified: 9 areas** where different agents would naturally make different choices without explicit rules.

### Naming Patterns

**Database Naming (PostgreSQL / Supabase):**
- Tables: `snake_case` plural → `recipes`, `users` (V2)
- Columns: `snake_case` → `recipe_id`, `user_id`, `created_at`
- Foreign keys: `{table_singular}_id` → `user_id`
- ✅ `recipes.created_at` ❌ `recipes.createdAt`, `recipes.CreatedAt`

**API Naming:**
- Endpoints: plural kebab-case → `/api/recipes`, `/api/recipes/[id]`
- Query params: `camelCase` → `?searchQuery=`, `?tagFilter=`
- ✅ `/api/recipes` ❌ `/api/recipe`, `/api/Recipe`

**Code Naming (TypeScript):**
- Components: `PascalCase.tsx` → `RecipeCard.tsx`, `HomeCarousel.tsx`
- Hooks: `camelCase.ts` starting with `use` → `useWakeLock.ts`, `useRecipeSearch.ts`
- Utilities / lib files: `camelCase.ts` → `supabaseClient.ts`
- Directories: `kebab-case` → `recipe-card/`, `home-carousel/`
- Types: `PascalCase`, prefer `type` over `interface` for data shapes → `type Recipe = { ... }`
- DB → client field mapping: **transform `snake_case` → `camelCase` at the data fetching layer** — Supabase returns `created_at`; TypeScript type uses `createdAt`

### Structure Patterns

**Project Organization:**
```
src/
  app/                        # Next.js App Router (routes, layouts, pages)
    api/recipes/              # Route handlers
    (home)/                   # Home screen route group
    recipes/[id]/             # Recipe detail
    library/                  # Grid view
  components/
    ui/                       # shadcn/ui primitives (auto-generated — do not hand-edit)
    recipes/                  # Recipe-specific components (RecipeCard, RecipeForm…)
    layout/                   # Navigation, shell components
  lib/
    schemas/                  # Zod schemas → recipe.ts
    supabase/                 # server.ts + client.ts
    i18n/                     # French string constants → fr.ts
    utils.ts                  # cn() and shared pure utilities
  hooks/                      # Custom React hooks → useWakeLock.ts, useRecipeSearch.ts
  types/                      # Shared TypeScript types → recipe.ts, api.ts
```

**Test Location:** Co-located `*.test.ts` / `*.test.tsx` alongside the file under test.
- ✅ `src/components/recipes/RecipeCard.test.tsx`
- ❌ `src/__tests__/RecipeCard.test.tsx`

### Format Patterns

**API Response Format:**

Success — return data directly, no wrapper:
```ts
// ✅
return NextResponse.json(recipe)
return NextResponse.json(recipes)

// ❌
return NextResponse.json({ data: recipe, success: true })
```

Error — always `{ error: string }`:
```ts
// ✅
return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
return NextResponse.json({ error: 'Title is required' }, { status: 422 })

// ❌
return NextResponse.json({ message: 'Not found' }, { status: 404 })
return NextResponse.json({ success: false, msg: '...' })
```

**Date Format:** ISO 8601 strings everywhere → `"2026-03-01T10:00:00Z"`. Never Unix timestamps.

**Null vs Undefined:** Use `null` for intentionally absent values in DB/API. Use `undefined` only for optional TypeScript props. Never return `undefined` from a Route Handler.

### Communication Patterns

**French UI Strings:**
- Never hardcode French strings directly in component JSX.
- All user-visible text defined in `src/lib/i18n/fr.ts` and imported by name.
- ✅ `import { t } from '@/lib/i18n/fr'` then `{t.confirmDelete}`
- ❌ `<button>Supprimer la recette</button>` inline in component

**Toast Notifications:**
- Always use shadcn/ui `useToast` hook — never `alert()` or custom toast implementations.
- Success toasts: brief (2–3s auto-dismiss), non-blocking.
- Error toasts: persistent until user dismisses.

**Loading States:**
- Route-level loading: `loading.tsx` files (Next.js App Router convention).
- Component-level: `<Suspense fallback={<Skeleton />}>` inside Server Components.
- Skeleton shown only if content takes >150ms (NFR-P5) — implement via CSS animation delay, not a JS timer.
- Never show a spinner for operations expected to complete under 150ms.

### Process Patterns

**Error Handling:**
- Route handlers: always catch, always return `{ error: string }` with appropriate HTTP status. Never let unhandled errors propagate to the client.
- Client Components: wrap mutations in `try/catch`, surface errors via `useToast`. Never fail silently.
- Error boundaries: one `error.tsx` per route segment. Not per-component.

**Form Validation Timing:**
- Validate on **submit** (Zod full parse).
- Show field-level errors on blur — but only after the first submit attempt.
- Never block the Save button for optional field validation — the title field is the only submission guard.

**Supabase Client Usage:**
- Server Components and Route Handlers → always `lib/supabase/server.ts`
- Client Components → always `lib/supabase/client.ts`
- Never import the server client inside a `'use client'` file. Never import the browser client in a Route Handler.

**`revalidatePath` After Mutations:**
- Every Route Handler that mutates data (POST, PUT, DELETE) **must** call `revalidatePath` before returning.
- Minimum paths to revalidate after any recipe mutation: `'/'` (home carousels) + `'/recipes/${id}'` (detail).

### Enforcement Guidelines

**All AI Agents MUST:**
- Follow the `src/` directory structure exactly — no new top-level directories without explicit architecture update
- Use `@/*` import alias for all cross-directory imports — never use relative paths that traverse upward (`../../`)
- Use the server Supabase client on the server, browser client on the client — no exceptions
- Define all French strings in `fr.ts` — never inline
- Call `revalidatePath` in every mutating Route Handler
- Return `{ error: string }` for all API errors — no alternative error shapes
- Transform DB `snake_case` → TypeScript `camelCase` at the data layer, not in components

**Anti-Patterns to Avoid:**
- ❌ Importing `lib/supabase/server.ts` in a `'use client'` component
- ❌ Hardcoding French text in JSX
- ❌ Returning `{ message: '...' }` from Route Handlers (use `{ error: '...' }`)
- ❌ Using `undefined` as a return value from API routes
- ❌ Creating `__tests__/` folders — tests are co-located
- ❌ Adding `use client` to a component that doesn't need browser APIs or interactivity
- ❌ Blocking recipe save on photo upload completion

## Project Structure & Boundaries

### Complete Project Directory Structure

```
atable/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json                  # shadcn/ui configuration
├── middleware.ts                    # Rate limiting — wraps all /api/* routes
├── .env.local                       # gitignored — local secrets
├── .env.example                     # committed — documents required vars
├── .gitignore
├── README.md
│
├── supabase/
│   └── migrations/
│       └── 001_create_recipes.sql   # recipes table + user_id FK (nullable)
│
├── public/
│   └── placeholder.svg              # Warm recipe placeholder image
│
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx               # Root: lang="fr", fonts, Toaster, AppShell
    │   ├── error.tsx                # Global error boundary
    │   ├── not-found.tsx
    │   │
    │   ├── (home)/                  # Route group — home screen
    │   │   ├── page.tsx             # Carousels (Server Component) — FR8, FR9, FR10, FR13
    │   │   └── loading.tsx          # Carousel skeletons
    │   │
    │   ├── library/                 # All recipes grid
    │   │   ├── page.tsx             # Grid view (Server Component) — FR12
    │   │   └── loading.tsx          # Grid skeleton
    │   │
    │   ├── recipes/
    │   │   ├── new/
    │   │   │   └── page.tsx         # Capture form (Client Component) — FR14, FR15, FR16, FR17
    │   │   └── [id]/
    │   │       ├── page.tsx         # Recipe detail (Server Component) — FR3, FR18, FR19, FR20, FR21
    │   │       ├── edit/
    │   │       │   └── page.tsx     # Edit form (Client Component) — FR4, FR6, FR7
    │   │       └── loading.tsx      # Detail skeleton
    │   │
    │   └── api/
    │       └── recipes/
    │           ├── route.ts         # GET /api/recipes, POST /api/recipes — FR1, FR2, FR35
    │           └── [id]/
    │               └── route.ts     # GET, PUT, DELETE /api/recipes/[id] — FR3, FR4, FR5
    │
    ├── components/
    │   ├── ui/                      # shadcn/ui primitives — do not hand-edit
    │   │   ├── button.tsx
    │   │   ├── card.tsx
    │   │   ├── input.tsx
    │   │   ├── textarea.tsx
    │   │   ├── toast.tsx
    │   │   ├── toaster.tsx
    │   │   ├── skeleton.tsx
    │   │   ├── badge.tsx
    │   │   └── dialog.tsx
    │   │
    │   ├── recipes/
    │   │   ├── RecipeCard.tsx           # Card for carousel + grid — FR10, FR11, FR29, FR30
    │   │   ├── RecipeCard.test.tsx
    │   │   ├── RecipeCardSkeleton.tsx   # Loading placeholder card
    │   │   ├── RecipeCarousel.tsx       # Horizontal scroll + tag header — FR8, FR9, FR10
    │   │   ├── RecipeCarousel.test.tsx
    │   │   ├── RecipeGrid.tsx           # Library grid view — FR12
    │   │   ├── RecipeForm.tsx           # Capture + edit form — FR1, FR2, FR4, FR6, FR14, FR15
    │   │   ├── RecipeForm.test.tsx
    │   │   ├── RecipeDetail.tsx         # Reading view — FR18, FR20, FR21
    │   │   ├── RecipePhoto.tsx          # Photo with warm placeholder — FR29, FR30
    │   │   ├── PhotoUploader.tsx        # Camera/gallery + async upload — FR27, FR28
    │   │   ├── TagBadge.tsx             # Tag display pill
    │   │   ├── RecipeSearch.tsx         # Search input + in-memory results — FR22–FR26
    │   │   ├── RecipeSearch.test.tsx
    │   │   ├── ConfirmDeleteDialog.tsx  # Delete confirmation — FR5
    │   │   └── EmptyState.tsx           # No results warm state — FR25, FR29
    │   │
    │   └── layout/
    │       ├── Navigation.tsx           # Bottom nav (mobile) / side rail (lg+) — FR31, FR32, FR33
    │       ├── Navigation.test.tsx
    │       ├── AppShell.tsx             # Wraps app, renders Navigation
    │       └── DeviceTokenProvider.tsx  # 'use client' — generates + persists UUID
    │
    ├── lib/
    │   ├── schemas/
    │   │   └── recipe.ts                # Zod v4: RecipeCreateSchema, RecipeUpdateSchema
    │   ├── supabase/
    │   │   ├── server.ts                # Server-side client (Route Handlers + Server Components)
    │   │   └── client.ts                # Browser client (Client Components only)
    │   ├── i18n/
    │   │   └── fr.ts                    # All French UI strings — single source of truth
    │   └── utils.ts                     # cn() + shared pure utilities
    │
    ├── hooks/
    │   ├── useWakeLock.ts               # Wake Lock API + silent fallback — FR19
    │   ├── useWakeLock.test.ts
    │   ├── useRecipeSearch.ts           # In-memory title/ingredient/tag filter — FR22–FR24
    │   ├── useRecipeSearch.test.ts
    │   ├── useDeviceToken.ts            # localStorage UUID read/write — NFR-S4
    │   └── usePhotoUpload.ts            # Async Supabase storage upload — FR27, NFR-P6
    │
    └── types/
        ├── recipe.ts                    # Recipe, RecipeFormData, RecipeListItem types
        └── api.ts                       # ApiError type, route handler response types
```

### Architectural Boundaries

**API Boundary — all external requests pass through here:**
- `middleware.ts` → intercepts all `/api/*` — rate limiting, request validation
- `src/app/api/recipes/route.ts` → list + create (GET, POST)
- `src/app/api/recipes/[id]/route.ts` → read, update, delete (GET, PUT, DELETE)
- All Route Handlers: Zod validate → Supabase query → `revalidatePath` → response

**Server / Client boundary:**

| Always Server Component | Always Client Component |
|---|---|
| `(home)/page.tsx` | `RecipeForm.tsx` |
| `library/page.tsx` | `RecipeSearch.tsx` |
| `recipes/[id]/page.tsx` | `Navigation.tsx` |
| `recipes/new/page.tsx` (page shell only) | `DeviceTokenProvider.tsx` |
| | `PhotoUploader.tsx` |
| | `ConfirmDeleteDialog.tsx` |
| | Wake Lock island in RecipeDetail |

**Data boundary:**
- `lib/supabase/server.ts` is the only entry point to the DB from the server
- `lib/supabase/client.ts` is the only entry point from the browser (photo uploads only)
- `types/recipe.ts` owns the canonical `Recipe` type — no inline type definitions in components

**Storage boundary:**
- All photo uploads go through `hooks/usePhotoUpload.ts` exclusively
- Path format enforced in this hook: `/{deviceToken}/{recipeId}/photo.webp`

### Requirements to Structure Mapping

| FR Group | Responsible Files |
|---|---|
| Recipe Management (FR1–7) | `api/recipes/route.ts`, `api/recipes/[id]/route.ts`, `RecipeForm.tsx`, `RecipeDetail.tsx`, `lib/schemas/recipe.ts` |
| Content Discovery (FR8–13) | `(home)/page.tsx`, `RecipeCarousel.tsx`, `RecipeCard.tsx` |
| Recipe Capture (FR14–17) | `recipes/new/page.tsx`, `RecipeForm.tsx` |
| Recipe Reading (FR18–21) | `recipes/[id]/page.tsx`, `RecipeDetail.tsx`, `useWakeLock.ts` |
| Search & Retrieval (FR22–26) | `RecipeSearch.tsx`, `useRecipeSearch.ts` |
| Media Management (FR27–30) | `PhotoUploader.tsx`, `RecipePhoto.tsx`, `usePhotoUpload.ts` |
| Responsive Experience (FR31–33) | `Navigation.tsx`, `AppShell.tsx` |
| System & Security (FR34–38) | `middleware.ts`, Supabase (sync), `eslint-plugin-jsx-a11y` (a11y) |

### Data Flow

```
User action (Client Component)
  → fetch / form submit
  → Route Handler (src/app/api/)
  → Zod validation (lib/schemas/recipe.ts)
  → Supabase query (lib/supabase/server.ts)
  → revalidatePath('/', '/recipes/[id]')
  → Response returned
  → Next.js cache invalidated
  → Server Component re-renders on next request
  → Updated data visible on all devices (cross-device sync)
```

**Photo upload flow (non-blocking parallel path):**
```
RecipeForm save → recipe saved to DB immediately (title only if needed)
  → recipe_id returned in response
  → usePhotoUpload hook fires async (non-blocking)
  → lib/supabase/client.ts → storage.upload()
  → path: /{deviceToken}/{recipeId}/photo.webp
  → success: revalidatePath('/recipes/[id]')
  → failure: dismissible error toast; recipe remains fully accessible
```

### External Integrations

| Service | Integration Point | Purpose |
|---|---|---|
| Supabase PostgreSQL | `lib/supabase/server.ts` | Recipe data storage + retrieval |
| Supabase Storage | `lib/supabase/client.ts` via `usePhotoUpload` | Photo file storage |
| Vercel | `next.config.ts` + deployment | Hosting, CDN, `next/image` optimization |
| Vercel Edge Network | `middleware.ts` | Rate limiting, DDoS protection |

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices are natively compatible. Next.js App Router + Supabase + Tailwind + shadcn/ui is a well-documented, production-tested combination. Zod v4 infers TypeScript types directly — zero duplication between schema and types. Vercel + Next.js is a first-class deployment pair with no additional configuration needed.

**Pattern Consistency:** Naming conventions (snake_case DB → camelCase TS) align with Supabase's default client behavior. The server/browser Supabase client split maps cleanly onto the RSC model. Error shape `{ error: string }` is consistent across all Route Handlers and client error handling.

**Structure Alignment:** The `(home)` route group isolates the home screen without affecting URL structure. The `lib/supabase/server.ts` + `client.ts` split directly enforces the server/client boundary rule. All 38 FRs are traceable to specific files.

### Requirements Coverage Validation ✅

**All 38 Functional Requirements covered** — each FR mapped to a specific file in the Project Structure section.

**All 22 Non-Functional Requirements covered:**

| NFR Category | Architectural Coverage |
|---|---|
| Performance (P1–P7) | Server Components for fast TTFB; `next/image` for WebP/AVIF; client-side search for 100ms; async photo for non-blocking save; `loading.tsx` + Suspense for skeleton threshold |
| Security (S1–S4) | `middleware.ts` (rate limiting); Vercel HTTPS; Supabase at-rest encryption; device token namespacing from day one |
| Accessibility (A1–A6) | shadcn/ui (keyboard, 44px touch targets); `lang="fr"` in `layout.tsx`; `eslint-plugin-jsx-a11y` blocks builds; Tailwind `motion-safe:` for reduced-motion |
| Reliability (R1–R4) | Explicit error toasts via `useToast`; non-cascading photo upload; `revalidatePath` for cross-device sync; silent Wake Lock fallback in `useWakeLock` |

### Gap Analysis — 3 Items Resolved

**Gap 1 (Critical) — `next.config.ts` image domain: RESOLVED**

`next/image` requires explicit `remotePatterns` to load Supabase storage URLs. Add to `next.config.ts`:
```ts
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '*.supabase.co',
      pathname: '/storage/v1/object/public/**'
    }
  ]
}
```

**Gap 2 (Critical) — Database schema: RESOLVED**

Canonical schema for `supabase/migrations/001_create_recipes.sql`:
```sql
CREATE TABLE recipes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,                          -- nullable V1, required V2
  title       TEXT        NOT NULL,
  ingredients TEXT,                          -- free text, newline-separated
  steps       TEXT,                          -- free text, newline-separated
  tags        TEXT[]      DEFAULT '{}',      -- PostgreSQL array
  photo_url   TEXT,                          -- Supabase public storage URL
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Gap 3 (Important) — Supabase storage bucket policy: RESOLVED**

Create a **public** bucket named `recipe-photos` in the Supabase dashboard. V1 uses public access — obscurity is provided by the device token path prefix, not bucket-level auth. Full storage path: `recipe-photos/{deviceToken}/{recipeId}/photo.webp`.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed (38 FRs, 22 NFRs)
- [x] Scale and complexity assessed (Low — standard CRUD, greenfield)
- [x] Technical constraints identified (iOS Safari, Wake Lock, V2 readiness)
- [x] Cross-cutting concerns mapped (7 identified and addressed)

**Architectural Decisions**
- [x] Critical decisions documented with versions (Zod v4, Next.js latest, shadcn latest)
- [x] Technology stack fully specified (Next.js + Tailwind + shadcn/ui + Supabase + Vercel)
- [x] Integration patterns defined (rate limiting, revalidatePath, async photo, device token)
- [x] Performance and reliability considerations addressed per NFR

**Implementation Patterns**
- [x] Naming conventions established (DB, API, TypeScript code)
- [x] Structure patterns defined (co-located tests, directory rules, import alias)
- [x] Communication patterns specified (French strings, toasts, loading states)
- [x] Process patterns documented (error handling, form validation timing, Supabase client usage)

**Project Structure**
- [x] Complete directory structure defined (all files named explicitly)
- [x] Component boundaries established (server/client split fully specified)
- [x] Integration points mapped (Supabase, Vercel, middleware)
- [x] All 38 FRs mapped to specific files and directories

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: High**

**Key Strengths:**
- Tech stack fully pre-decided — zero decision fatigue for implementing agents
- All 38 FRs traced to a specific file — no ambiguity about where features live
- V2 readiness baked into V1 schema (`user_id` FK) and storage (device token path) — no breaking migrations ahead
- Async photo upload pattern fully specified — the trickiest UX flow is not left to agent interpretation
- 9 conflict points explicitly addressed — agents cannot silently diverge on naming, error shapes, or Supabase client usage

**Areas for Future Enhancement (V2):**
- Upstash Redis for proper per-IP sliding window rate limiting
- Auth middleware insertion into existing Route Handlers (already structurally prepared)
- Add `NOT NULL` constraint to `user_id` once auth lands — no schema migration needed
- Evaluate TanStack Query if data fetching complexity grows significantly

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented — no technology substitutions
- Use implementation patterns consistently across all components
- Respect the server/client component split table — do not add `'use client'` without justification
- Use `@/*` import alias exclusively — no upward relative paths
- Refer to this document for all architectural questions before making assumptions

**First Implementation Story:** Project scaffold
```bash
npx create-next-app@latest atable \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npx shadcn@latest init
```
