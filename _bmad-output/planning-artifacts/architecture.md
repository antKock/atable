---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad-output/planning-artifacts/v3-screen-mockups.html"
  - "docs/atable-v3-features-recap.md"
  - "_bmad-output/planning-artifacts/v2/architecture.md"
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-03-13'
project_name: 'atable'
user_name: 'Anthony'
date: '2026-03-13'
---

# Architecture Decision Document — atable v3 (AI Enrichment)

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (42 FRs across 10 capability areas):**

- **AI Enrichment (FR1–6):** Single GPT-4o-mini call per recipe save (create + edit), async post-save, structured JSON response with all metadata fields, retry with exponential backoff (3 attempts), non-blocking — recipe save never waits for AI.
- **AI Image Generation (FR7–12):** DALL-E 3 (1024×1024) on creation only, manual re-gen on edit via explicit button, server-side download → OVH Object Storage, fixed style suffix appended to LLM-generated dish description prompt, failure falls back to placeholder/user photo.
- **Tag System (FR13–18):** Curated predefined tags (~50+) across 6 categories (Type de plat, Régime, Protéine, Cuisine, Occasion, Caractéristiques). AI selects only from predefined list. Users can create custom tags. Category-grouped autocompletion in edit form. Tags displayed as visual chips.
- **Season (FR19–23):** Dedicated field (not a tag), multi-select: Printemps, Été, Automne, Hiver. AI-inferred from ingredients. "De saison" toggle filters by current calendar season.
- **Prep/Cook Time (FR24–28):** Predefined ranges (prep: 5 ranges, cook: 6 ranges). AI-inferred. Filterable by total duration (sum of range bounds).
- **Cost (FR29–31):** Three levels (€, €€, €€€). AI-inferred from ingredients. Manually overridable.
- **Complexity (FR32–34):** Three levels (facile, moyen, difficile). AI-inferred. Manually overridable.
- **Enrichment UX (FR35–37):** Shimmer loading animation during enrichment, in-place reveal (300ms fade-in) without page refresh, all AI fields visually overridable.
- **Demo Mode (FR38–39):** Demo seed data includes v3 metadata (tags, seasons, time, cost, generated images). Existing v2 shared household + 24h cron reset handles isolation.
- **PWA (FR40–42):** `manifest.json` with app name "À Table", icons, theme color `#F8FAF7`, `display: standalone`. No service worker for v3 MVP.

**Non-Functional Requirements:**

| Category | Key Requirements |
|---|---|
| **Performance** | Save <500ms (enrichment async); enrichment <10s; image gen <30s; tag autocomplete <100ms (client-side); carousels <1.5s; all v1/v2 targets unchanged |
| **Security** | OpenAI API key server-side only (Route Handlers); generated images proxied through OVH Storage (no DALL-E URLs to client); all v2 session auth NFRs inherited |
| **Reliability** | Enrichment failure non-blocking (fields stay empty); retry with exponential backoff (3 attempts); image failure non-blocking (placeholder/user photo); graceful degradation on full OpenAI outage |
| **Integration** | Pinned OpenAI model version; structured output validated against schema before persisting; OVH Object Storage same bucket/pattern as user photos |

**Scale & Complexity:**

- Primary domain: Full-stack web (Next.js App Router + Supabase + OpenAI API)
- Complexity level: **Low** — standard web patterns, single external API integration, no real-time collaboration, no regulated data
- Estimated new architectural components: ~12 (OpenAI client, enrichment pipeline, image pipeline, tags table + junction, tag API, enrichment status detection, filter/carousel queries, tag autocomplete, shimmer components, PWA manifest, demo seed update, view tracking)

### Technical Constraints & Dependencies

- **Stack fixed (v1+v2 inheritance):** Next.js App Router, TypeScript, Tailwind CSS v4, shadcn/ui, Supabase (PostgreSQL + Storage), Vercel, OVH Object Storage — no new infrastructure beyond OpenAI API
- **OpenAI API is the sole new external dependency:** GPT-4o-mini for enrichment, DALL-E 3 for image generation. Both server-side only. API key as env variable.
- **Brownfield constraint:** v1 (recipe CRUD) + v2 (household auth) are deployed and actively used. V3 is purely additive — no changes to existing recipe save flow, no changes to auth model, no changes to existing API contracts. New metadata fields are additive columns/relations.
- **OVH Object Storage pattern exists:** User photo upload pipeline (server-side upload to S3-compatible OVH bucket) is already built. Generated images use the same path.
- **Async pattern constraint:** Enrichment must run after the HTTP save response is sent. No job queue infrastructure exists (Vercel serverless). The async mechanism must work within Vercel's execution model.
- **"Fill empty only" enrichment strategy (UX-driven):** AI only fills fields that are null. Existing values (AI-set or user-corrected) are never overwritten. This eliminates the need for per-field `user_modified` flags but means content-change-driven re-tagging does not happen automatically.
- **v2 architecture patterns in force:** All v2 conventions (session middleware, household scoping, `x-household-id` header propagation, Redis revocation, `lib/auth/session.ts` centralization) are inherited unchanged.

### Cross-Cutting Concerns Identified

1. **Async enrichment pipeline** — Post-save fire-and-forget with two independent processes (metadata enrichment ~5-10s, image generation ~15-30s). Must work within Vercel serverless execution model. Must not block the save response. Must handle failures silently.
2. **Enrichment status detection** — Client needs to know when metadata and image become available. Architectural choice: polling vs SSE vs revalidation. Two independent completion events (metadata first, image later).
3. **Tag relational model** — Tags stored as relations (recipe ↔ tag junction table), not JSON arrays. Predefined tags seeded in a `tags` table. Custom user tags added to the same table. Enables efficient carousel and filter queries.
4. **Image pipeline** — DALL-E 3 URL → server-side download → upload to OVH Object Storage → store OVH URL on recipe. Same pattern as existing user photo uploads. Must handle download/upload failures gracefully.
5. **Carousel query optimization** — 13 curated home sections, each with specific query rules (tag-based, metadata-based, behavior-based). Sections hidden if <1 recipe matches. Must stay within <1.5s home load target.
6. **View tracking** — Two new fields (`last_viewed_at`, `view_count`) updated on each detail page load. Drive "Récentes" and "Redécouvrir" carousels. Must not add perceptible latency to detail page loads.

## Starter Template Evaluation

### Primary Technology Domain

Brownfield full-stack web application — v1 (recipe CRUD) + v2 (household auth) are deployed and actively used. No new project scaffold required.

### Brownfield Foundation

The existing codebase provides the complete stack foundation:

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js (App Router) | 16.1.6 |
| **Runtime** | React | 19.2.3 |
| **Language** | TypeScript | ^5 |
| **Styling** | Tailwind CSS v4 + shadcn/ui | ^4 / ^3.8.5 |
| **Database** | Supabase (PostgreSQL + Storage) | ^2.98.0 |
| **Auth** | Custom JWS (jose) + Upstash Redis | ^6.1.3 / ^1.36.3 |
| **Validation** | Zod | ^4.3.6 |
| **Testing** | Vitest + Testing Library | ^4.0.18 / ^16.3.2 |
| **Deployment** | Vercel (auto-deploy on push to main) | — |
| **Icons** | Lucide React | ^0.575.0 |

All v1/v2 conventions (naming, structure, patterns) documented in v2 `architecture.md` are inherited unchanged.

### New Dependency for v3

| Package | Purpose |
|---|---|
| `openai` (npm) | Official OpenAI SDK — GPT-4o-mini structured output + DALL-E 3 image generation. Server-side only (Route Handlers). |

**New environment variable:**
```
OPENAI_API_KEY=          # OpenAI dashboard — server-side only
```

**Note:** No `create-next-app` or other initialization needed. First implementation story is the DB schema migration, not project setup.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Async enrichment trigger: `waitUntil()` in Route Handlers
- Client enrichment detection: polling via status endpoint
- Enrichment status tracking: explicit `enrichment_status` + `image_status` columns
- Tag storage: single `tags` table with `is_predefined` flag + `recipe_tags` junction
- OpenAI structured output: native `zodResponseFormat` + server-side Zod validation
- Season storage: PostgreSQL `TEXT[]` array column on `recipes`

**Important Decisions (Shape Architecture):**
- Carousel queries: parallel independent queries via `Promise.all()`
- Image pipeline: reuse existing OVH Object Storage upload pattern
- "Fill empty only" enrichment: check field presence, not status column

**Deferred Decisions (Post-MVP):**
- Batch enrichment for existing recipes (after validating AI quality on new recipes)
- Carousel caching (only if parallel queries prove too slow at scale)
- Offline PWA support (service worker not in v3 scope)

### Data Architecture

**DB Schema: New Tables**

```sql
CREATE TABLE tags (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  category      TEXT,                       -- null for custom tags
  is_predefined BOOLEAN     NOT NULL DEFAULT false,
  household_id  UUID        REFERENCES households(id) ON DELETE CASCADE,  -- null for predefined
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, household_id)               -- unique per household (predefined: household_id IS NULL)
);
CREATE INDEX ON tags(household_id);
CREATE INDEX ON tags(is_predefined);

CREATE TABLE recipe_tags (
  recipe_id     UUID        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tag_id        UUID        NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);
```

`recipes` migration — new columns:
```sql
ALTER TABLE recipes
  ADD COLUMN prep_time          TEXT,         -- '< 10 min', '10-20 min', etc.
  ADD COLUMN cook_time          TEXT,         -- 'Aucune', '< 15 min', etc.
  ADD COLUMN cost               TEXT,         -- '€', '€€', '€€€'
  ADD COLUMN complexity         TEXT,         -- 'facile', 'moyen', 'difficile'
  ADD COLUMN seasons            TEXT[],       -- '{printemps,ete,automne,hiver}'
  ADD COLUMN image_prompt       TEXT,         -- LLM-generated dish description
  ADD COLUMN generated_image_url TEXT,        -- OVH Object Storage URL
  ADD COLUMN enrichment_status  TEXT NOT NULL DEFAULT 'none',  -- 'none' | 'pending' | 'enriched' | 'failed'
  ADD COLUMN image_status       TEXT NOT NULL DEFAULT 'none',  -- 'none' | 'pending' | 'generated' | 'failed'
  ADD COLUMN last_viewed_at     TIMESTAMPTZ,
  ADD COLUMN view_count         INTEGER      NOT NULL DEFAULT 0;
```

**Enrichment Status Model:**
- `enrichment_status`: `none` → `pending` (on save) → `enriched` (success) or `failed` (after 3 retries)
- `image_status`: `none` → `pending` (on create) → `generated` (success) or `failed` (after 3 retries)
- Poll endpoint returns these two values; client shows shimmer for `pending`, content for `enriched`/`generated`, dash for `failed`

**"Fill Empty Only" Logic:**
- On enrichment, check each field's current value (not the status column)
- If field has a value → skip. If null → fill from AI response
- Status column tracks the pipeline lifecycle, not per-field state

### Authentication & Security

Inherited from v2 — no changes. New security concern:

- `OPENAI_API_KEY` stored as server-side env variable, used only in `lib/openai.ts`
- Generated DALL-E 3 image URLs are never exposed to the client — images downloaded server-side, uploaded to OVH, served from OVH URL
- All enrichment API calls are server-side only (Route Handlers)

### API & Communication Patterns

**Async Enrichment Flow:**
```
POST/PUT /api/recipes/[id]
  → Save recipe to DB
  → Set enrichment_status = 'pending', image_status = 'pending' (create) or unchanged (edit)
  → waitUntil(enrichRecipe(id))  -- Vercel keeps function alive
  → Return 200/201 immediately

enrichRecipe(id):
  → Call GPT-4o-mini with zodResponseFormat (structured output)
  → Validate response with Zod schema
  → "Fill empty only": update only null fields in DB
  → Set enrichment_status = 'enriched'
  → If create: download DALL-E 3 image → upload to OVH → set generated_image_url, image_status = 'generated'
  → On failure: set enrichment_status/image_status = 'failed' after 3 retries
```

**New Route Handlers:**

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/recipes/[id]/status` | Enrichment polling — returns `{ enrichmentStatus, imageStatus }` |
| `GET` | `/api/tags` | List all tags (predefined + household custom) for autocomplete |
| `POST` | `/api/tags` | Create custom tag (household-scoped) |

**Existing Route Handler modifications:**
- `POST /api/recipes` — add `waitUntil(enrichRecipe(id))`, set initial status columns
- `PUT /api/recipes/[id]` — add `waitUntil(enrichRecipe(id))`, re-enrich with "fill empty only"
- `GET /api/recipes/[id]` — include tags (join), new metadata columns in response
- `GET /api/recipes` — include tags, support tag/season/time/cost filter params

**Client Polling Pattern:**
```
useEnrichmentPolling(recipeId):
  → Poll GET /api/recipes/[id]/status every 3s
  → Stop when enrichmentStatus ∈ ['enriched', 'failed'] AND imageStatus ∈ ['generated', 'failed', 'none']
  → On status change: trigger router.refresh() to re-fetch Server Component data
  → Max polling duration: 60s (safety cutoff)
```

### Frontend Architecture

**State management:** Unchanged from v1. No global state for enrichment — the polling hook is local to the recipe detail page.

**New client-side concerns:**
- `useEnrichmentPolling` hook — polls status endpoint, triggers refresh on completion
- Tag autocomplete — client-side filtering on preloaded tag list (fetched once from `GET /api/tags`)
- Filter bar state — local state for active filters in library view, URL params for shareable filter state

### Infrastructure & Deployment

Inherited from v2. One addition:

**New environment variable:**
```
OPENAI_API_KEY=          # OpenAI dashboard — server-side only
```

**`waitUntil()` requirement:** Vercel Functions must have sufficient execution time for enrichment (~10s) + image generation (~30s). Default Vercel Pro plan allows 60s function duration — sufficient.

### Decision Impact Analysis

**Implementation Sequence:**
1. DB migration (new tables + new columns on `recipes`)
2. `lib/openai.ts` — OpenAI client singleton + enrichment Zod schema
3. `lib/enrichment.ts` — enrichment pipeline (GPT-4o-mini call + "fill empty only" persist + image generation)
4. Modify `POST /api/recipes` + `PUT /api/recipes/[id]` — add `waitUntil()` trigger
5. `GET /api/recipes/[id]/status` — polling endpoint
6. `GET /api/tags` + `POST /api/tags` — tag API
7. Seed predefined tags in migration
8. Modify recipe detail page — shimmer states + enrichment polling
9. Modify recipe form — tag input, metadata fields (edit mode)
10. Home page carousels — 13 parallel queries
11. Library filter bar — tag/season/time/cost filtering
12. PWA manifest
13. Demo seed data update

**Cross-Component Dependencies:**
- `OPENAI_API_KEY` → `lib/openai.ts` → consumed by `lib/enrichment.ts` → called via `waitUntil()` from recipe Route Handlers
- `lib/enrichment.ts` writes to `recipes` + `recipe_tags` → read by detail page, carousels, library filters
- `tags` table (seeded in migration) → consumed by `GET /api/tags` → used by tag autocomplete + enrichment pipeline
- `enrichment_status` / `image_status` → written by `lib/enrichment.ts` → read by `/api/recipes/[id]/status` → consumed by `useEnrichmentPolling` hook

## Implementation Patterns & Consistency Rules — V3 Additions

**V1/v2 patterns from `v2/architecture.md` remain in force.** This section documents only the new conflict points introduced by the AI enrichment layer.

**New critical conflict points identified: 8 areas** where agents could make different choices for the v3 features.

### OpenAI-Specific Patterns

**Conflict Point 1 — OpenAI client centralization:**
**Rule: All OpenAI API calls go through `src/lib/openai.ts` exclusively.**

`lib/openai.ts` is the ONLY file that imports the `openai` SDK, instantiates the client, or holds the API key reference. Enrichment and image generation call functions exported from this module.

```ts
// ✅
import { enrichRecipe, generateImage } from '@/lib/openai'

// ❌ Never import openai SDK directly outside lib/openai.ts
import OpenAI from 'openai'
```

**Conflict Point 2 — Enrichment pipeline centralization:**
**Rule: All enrichment logic lives in `src/lib/enrichment.ts`. Route Handlers call `enrichRecipe(id)` — they never orchestrate the pipeline themselves.**

`lib/enrichment.ts` owns: reading the recipe, calling OpenAI, applying "fill empty only" logic, writing metadata to DB, triggering image generation, updating status columns. Route Handlers just call `waitUntil(enrichRecipe(id))`.

```ts
// ✅ In route handler
import { enrichRecipe } from '@/lib/enrichment'
waitUntil(enrichRecipe(recipeId))

// ❌ Never inline enrichment logic in a route handler
const openai = new OpenAI()
const result = await openai.chat.completions.create(...)
```

**Conflict Point 3 — Enrichment Zod schema is the single source of truth:**
**Rule: The Zod schema for the enrichment response lives in `src/lib/schemas/enrichment.ts`. This same schema is used for `zodResponseFormat` AND for server-side validation.**

```ts
// ✅ One schema, two uses
import { EnrichmentResponseSchema } from '@/lib/schemas/enrichment'
// Used in: zodResponseFormat(EnrichmentResponseSchema) AND .parse(response)

// ❌ Never define the enrichment shape inline or in multiple places
```

### Tag-Specific Patterns

**Conflict Point 4 — Tag loading in recipe queries:**
**Rule: When fetching recipes that need tags, always use a Supabase join: `.select('*, recipe_tags(tag_id, tags(id, name, category))')`. Never fetch tags in a separate query.**

```ts
// ✅ Single query with join
const { data } = await supabase
  .from('recipes')
  .select('*, recipe_tags(tag_id, tags(id, name, category))')
  .eq('household_id', householdId)

// ❌ Never fetch tags separately
const recipe = await supabase.from('recipes').select('*')...
const tags = await supabase.from('recipe_tags').select('*').eq('recipe_id', id)
```

**Conflict Point 5 — Tag mutation pattern:**
**Rule: When updating tags on a recipe, always delete-then-insert (replace all). Never try to diff existing vs new tags.**

```ts
// ✅ Replace all tags atomically
await supabase.from('recipe_tags').delete().eq('recipe_id', id)
await supabase.from('recipe_tags').insert(newTagIds.map(tagId => ({ recipe_id: id, tag_id: tagId })))

// ❌ Never diff and selectively insert/delete
```

### Enrichment-Specific Patterns

**Conflict Point 6 — "Fill empty only" logic location:**
**Rule: The "fill empty only" check happens inside `lib/enrichment.ts` BEFORE writing to DB. It reads the current recipe, checks each field, and only updates null fields. Route Handlers never implement this logic.**

```ts
// ✅ Inside lib/enrichment.ts
const current = await getRecipe(id)
const updates: Partial<Recipe> = {}
if (!current.prepTime) updates.prep_time = aiResult.prepTime
if (!current.cookTime) updates.cook_time = aiResult.cookTime
// ... etc

// ❌ Never check field presence in route handlers or client code
```

**Conflict Point 7 — Image pipeline flow:**
**Rule: Image generation is part of `lib/enrichment.ts`, triggered AFTER metadata enrichment succeeds. The flow is: enrich metadata → persist → generate image → download → upload to OVH → persist URL. Image failure does NOT roll back metadata enrichment.**

```
enrichRecipe(id):
  1. GPT-4o-mini call → metadata
  2. Persist metadata + set enrichment_status = 'enriched'
  3. If image needed: DALL-E 3 call → download → OVH upload → persist URL + set image_status = 'generated'
  4. Image failure: set image_status = 'failed' (metadata stays enriched)
```

**Conflict Point 8 — Enrichment status transitions:**
**Rule: Status columns are ONLY written by `lib/enrichment.ts` (and the initial `pending` set by the Route Handler on save). No other file modifies `enrichment_status` or `image_status`.**

```ts
// ✅ Route Handler sets initial state
await supabase.from('recipes').update({ enrichment_status: 'pending' }).eq('id', id)
waitUntil(enrichRecipe(id))  // lib/enrichment.ts handles all subsequent transitions

// ❌ Never set enrichment_status = 'enriched' outside lib/enrichment.ts
```

### Enforcement Guidelines — V3 Additions

**All AI Agents MUST:**
- Use `lib/openai.ts` for all OpenAI API calls — never import the SDK directly
- Use `lib/enrichment.ts` for all enrichment orchestration — never inline pipeline logic
- Use the shared Zod schema from `lib/schemas/enrichment.ts` for both API format and validation
- Join tags in recipe queries — never fetch tags separately
- Replace-all for tag mutations — never diff
- Implement "fill empty only" inside `lib/enrichment.ts` only
- Let image failure degrade independently of metadata enrichment
- Only modify status columns from `lib/enrichment.ts` (except initial `pending` in Route Handler)

**Anti-Patterns to Avoid:**
- ❌ Importing `openai` SDK outside `lib/openai.ts`
- ❌ Orchestrating enrichment steps inside a Route Handler
- ❌ Defining enrichment response shapes in multiple files
- ❌ Fetching tags in a separate query from the recipe
- ❌ Diffing tag arrays instead of replace-all
- ❌ Checking "fill empty only" in route handlers or client code
- ❌ Rolling back metadata on image generation failure
- ❌ Setting `enrichment_status = 'enriched'` anywhere except `lib/enrichment.ts`

## Project Structure & Boundaries

### Complete Project Directory Structure

```
atable/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json
├── vercel.json                          # Vercel Cron config (existing)
├── middleware.ts                        # Auth gate (existing — unchanged)
├── .env.local                           # MODIFIED — add OPENAI_API_KEY
├── .env.example                         # MODIFIED — add OPENAI_API_KEY
│
├── public/
│   ├── placeholder.svg
│   └── manifest.json                    # NEW — PWA manifest (FR40–42)
│
├── supabase/
│   └── migrations/
│       ├── 001_create_recipes.sql       # existing
│       ├── 002_household_auth.sql       # existing
│       └── 003_ai_enrichment.sql        # NEW — tags, recipe_tags, recipe columns
│
└── src/
    ├── app/
    │   ├── globals.css                  # MODIFIED — add shimmer + tag chip tokens
    │   ├── layout.tsx                   # MODIFIED — add <link rel="manifest">
    │   ├── error.tsx
    │   ├── not-found.tsx
    │   ├── icon.tsx
    │   ├── opengraph-image.tsx
    │   │
    │   ├── (landing)/                   # existing — unchanged
    │   │   ├── layout.tsx
    │   │   ├── page.tsx
    │   │   └── join/[code]/page.tsx
    │   │
    │   ├── (app)/                       # existing route group
    │   │   ├── layout.tsx
    │   │   ├── home/
    │   │   │   ├── page.tsx             # MODIFIED — 13 parallel carousel queries
    │   │   │   └── loading.tsx
    │   │   ├── library/
    │   │   │   ├── page.tsx             # MODIFIED — filter bar + tag/season/time/cost params
    │   │   │   └── loading.tsx
    │   │   ├── recipes/[id]/
    │   │   │   ├── page.tsx             # MODIFIED — metadata display, shimmer, view tracking
    │   │   │   ├── edit/page.tsx        # MODIFIED — tag input, metadata fields, photo manager
    │   │   │   └── loading.tsx
    │   │   └── household/               # existing — unchanged
    │   │       ├── page.tsx
    │   │       └── loading.tsx
    │   │
    │   ├── (app-fullscreen)/            # existing route group
    │   │   ├── layout.tsx
    │   │   └── recipes/new/page.tsx     # MODIFIED — same enrichment trigger as edit
    │   │
    │   └── api/
    │       ├── recipes/
    │       │   ├── route.ts             # MODIFIED — add filter params, include tags in response
    │       │   └── [id]/
    │       │       ├── route.ts         # MODIFIED — waitUntil(enrichRecipe), include tags
    │       │       ├── photo/route.ts   # existing — unchanged
    │       │       └── status/route.ts  # NEW — enrichment polling endpoint
    │       ├── tags/
    │       │   └── route.ts             # NEW — GET list + POST create custom tag
    │       ├── households/              # existing — unchanged
    │       ├── devices/                 # existing — unchanged
    │       ├── demo/session/route.ts    # existing — unchanged
    │       ├── auth/session/route.ts    # existing — unchanged
    │       └── cron/demo-reset/route.ts # MODIFIED — reset v3 metadata + tags in demo
    │
    ├── components/
    │   ├── ui/                          # existing shadcn/ui — unchanged
    │   ├── auth/                        # existing — unchanged
    │   ├── household/                   # existing — unchanged
    │   ├── demo/                        # existing — unchanged
    │   ├── layout/                      # existing — unchanged
    │   └── recipes/
    │       ├── RecipeCard.tsx            # MODIFIED — generated image fallback, v3 info overlay
    │       ├── RecipeCarousel.tsx        # MODIFIED — accept v3 carousel section data
    │       ├── RecipeForm.tsx            # MODIFIED — tag input, metadata fields, photo manager
    │       ├── HomeContent.tsx           # MODIFIED — render 13 carousel sections
    │       ├── PhotoPicker.tsx           # MODIFIED — add Régénérer/Remplacer/Supprimer actions
    │       ├── ConfirmDeleteDialog.tsx   # existing — unchanged
    │       ├── WakeLockActivator.tsx     # existing — unchanged
    │       ├── ShimmerBlock.tsx          # NEW — shimmer loading for enrichment slots
    │       ├── MetadataGrid.tsx          # NEW — 2×2 prep/cook/cost/complexity display
    │       ├── TagChip.tsx              # NEW — removable tag badge
    │       ├── TagInput.tsx             # NEW — autocomplete with category-grouped dropdown
    │       ├── SeasonBadge.tsx          # NEW — season label display
    │       ├── FilterBar.tsx            # NEW — horizontal scrollable filter pills
    │       ├── FilterPill.tsx           # NEW — toggle/category pill
    │       ├── FilterDropdown.tsx       # NEW — expanded tag panel below filter bar
    │       ├── ChipSelector.tsx         # NEW — multi-select chips (cost, seasons)
    │       └── PhotoManager.tsx         # NEW — photo preview + 3 frosted-glass CTAs
    │
    ├── hooks/
    │   ├── useRecipeSearch.ts           # existing — unchanged
    │   ├── usePhotoUpload.ts            # existing — unchanged
    │   ├── useWakeLock.ts               # existing — unchanged
    │   ├── useDeviceToken.ts            # existing — unchanged
    │   └── useEnrichmentPolling.ts      # NEW — polls status, triggers router.refresh()
    │
    ├── lib/
    │   ├── openai.ts                    # NEW — OpenAI client singleton, GPT-4o-mini + DALL-E 3
    │   ├── enrichment.ts                # NEW — enrichment pipeline orchestrator
    │   ├── redis.ts                     # existing — unchanged
    │   ├── utils.ts                     # existing — unchanged
    │   ├── recipe-placeholder.ts        # existing — unchanged
    │   ├── auth/                        # existing — unchanged
    │   ├── schemas/
    │   │   ├── recipe.ts                # MODIFIED — add v3 metadata fields to schemas
    │   │   ├── household.ts             # existing — unchanged
    │   │   └── enrichment.ts            # NEW — Zod schema for OpenAI structured output
    │   ├── supabase/
    │   │   ├── server.ts                # existing — unchanged
    │   │   ├── client.ts                # existing — unchanged
    │   │   └── mappers.ts              # MODIFIED — map v3 columns + flatten tags
    │   └── i18n/
    │       └── fr.ts                    # MODIFIED — add v3 strings (tags, filters, seasons)
    │
    └── types/
        ├── recipe.ts                    # MODIFIED — add v3 fields to Recipe type
        ├── api.ts                       # existing — unchanged
        └── household.ts                 # existing — unchanged
```

### Architectural Boundaries

**Enrichment boundary:**
- `lib/openai.ts` → sole owner of OpenAI SDK import + client instantiation
- `lib/enrichment.ts` → sole owner of enrichment pipeline orchestration
- `lib/schemas/enrichment.ts` → sole owner of enrichment response Zod schema
- Route Handlers call `waitUntil(enrichRecipe(id))` — nothing else

**Server / Client boundary — new components:**

| Always Server Component | Always Client Component |
|---|---|
| `(app)/home/page.tsx` (carousel queries) | `ShimmerBlock.tsx` |
| `(app)/library/page.tsx` (filter queries) | `TagInput.tsx`, `TagChip.tsx` |
| `(app)/recipes/[id]/page.tsx` (detail fetch) | `FilterBar.tsx`, `FilterPill.tsx`, `FilterDropdown.tsx` |
| | `MetadataGrid.tsx` (when shimmer state needed) |
| | `ChipSelector.tsx`, `SeasonBadge.tsx` |
| | `PhotoManager.tsx` |
| | `useEnrichmentPolling.ts` (hook) |

**Tag boundary:**
- `GET /api/tags` + `POST /api/tags` → tag CRUD
- `lib/enrichment.ts` → reads predefined tags for AI prompt, writes recipe_tags
- `TagInput.tsx` → client-side filtering on preloaded tag list

### Requirements to Structure Mapping

| FR Group | Responsible Files |
|---|---|
| AI Enrichment (FR1–6) | `lib/openai.ts`, `lib/enrichment.ts`, `lib/schemas/enrichment.ts`, `api/recipes/[id]/route.ts` |
| AI Image Generation (FR7–12) | `lib/enrichment.ts` (image pipeline), `lib/openai.ts` (DALL-E call), `PhotoManager.tsx` (re-gen UI) |
| Tag System (FR13–18) | `api/tags/route.ts`, `TagInput.tsx`, `TagChip.tsx`, `003_ai_enrichment.sql` (seed data) |
| Season (FR19–23) | `SeasonBadge.tsx`, `ChipSelector.tsx`, `FilterBar.tsx` ("De saison" pill), `lib/enrichment.ts` |
| Prep/Cook Time (FR24–28) | `MetadataGrid.tsx`, `RecipeForm.tsx` (select dropdowns), `FilterBar.tsx` (Durée filter) |
| Cost (FR29–31) | `MetadataGrid.tsx`, `ChipSelector.tsx` (edit form), `FilterBar.tsx` (Coût filter) |
| Complexity (FR32–34) | `MetadataGrid.tsx`, `RecipeForm.tsx` (select dropdown) |
| Enrichment UX (FR35–37) | `ShimmerBlock.tsx`, `useEnrichmentPolling.ts`, `api/recipes/[id]/status/route.ts` |
| Demo Mode (FR38–39) | `api/cron/demo-reset/route.ts` (add v3 seed data reset) |
| PWA (FR40–42) | `public/manifest.json`, `src/app/layout.tsx` (manifest link) |

### Data Flow

**Enrichment data flow:**
```
User saves recipe
  → POST /api/recipes → DB insert → waitUntil(enrichRecipe(id))
  → Response 201 → Client redirects to detail page
  → Detail page renders with shimmer (enrichment_status = 'pending')
  → useEnrichmentPolling polls /api/recipes/[id]/status every 3s

Background (waitUntil):
  → lib/enrichment.ts reads recipe from DB
  → lib/openai.ts calls GPT-4o-mini (structured output)
  → lib/enrichment.ts applies "fill empty only" + writes metadata + tags to DB
  → lib/enrichment.ts sets enrichment_status = 'enriched'
  → lib/openai.ts calls DALL-E 3 → download → OVH upload
  → lib/enrichment.ts sets generated_image_url + image_status = 'generated'

Client detects status change → router.refresh() → Server Component re-renders with data
```

### External Integrations

| Service | Integration Point | Purpose |
|---|---|---|
| Supabase PostgreSQL | `lib/supabase/server.ts` (unchanged) | All DB including new v3 tables |
| OVH Object Storage | `lib/enrichment.ts` (new) | Generated DALL-E image storage |
| OpenAI API | `lib/openai.ts` (new) | GPT-4o-mini enrichment + DALL-E 3 images |
| Upstash Redis | `lib/redis.ts` (unchanged) | Rate limiting + revocation cache |
| Vercel Edge | `middleware.ts` (unchanged) | Auth gate |
| Vercel Cron | `api/cron/demo-reset` (modified) | 24h demo reset with v3 data |

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices are compatible and conflict-free:
- Next.js 16 + Vercel `waitUntil()` — native support, no polyfill needed
- OpenAI SDK + Zod v4 `zodResponseFormat` — structured outputs work with Zod v4's `.toJSONSchema()`
- Supabase PostgreSQL `TEXT[]` for seasons — native array support, no ORM mismatch
- OVH Object Storage reuses existing upload pattern from v2 user photos

**Pattern Consistency:**
All v3 implementation patterns extend v2 conventions without contradiction:
- Centralization pattern (openai.ts, enrichment.ts, schemas/enrichment.ts) mirrors v2's existing module boundaries
- Naming conventions (snake_case DB → camelCase TS via `mapDbRowToRecipe`) unchanged
- Tag replace-all pattern aligns with Supabase's bulk insert/delete approach
- Status column naming (`enrichment_status`, `image_status`) follows v2's existing column naming

**Structure Alignment:**
Project structure supports all architectural decisions:
- `lib/` directory houses all new server-side modules (openai, enrichment, schemas)
- `components/recipes/` groups all new UI components alongside existing recipe components
- `hooks/` houses `useEnrichmentPolling` alongside existing hooks
- Single new migration file (`003_ai_enrichment.sql`) contains all schema changes

### Requirements Coverage Validation ✅

**Functional Requirements Coverage (42/42):**
- FR1–6 (AI Enrichment): Covered by `lib/enrichment.ts` + `lib/openai.ts` + `waitUntil()` pattern
- FR7–12 (AI Image): Covered by DALL-E 3 pipeline in `lib/enrichment.ts` + `PhotoManager.tsx` re-gen UI
- FR13–18 (Tags): Covered by `tags`/`recipe_tags` tables + `api/tags/route.ts` + `TagInput.tsx`
- FR19–23 (Seasons): Covered by `TEXT[]` column + `SeasonBadge.tsx` + "De saison" filter pill
- FR24–28 (Prep/Cook Time): Covered by predefined range fields + `MetadataGrid.tsx` display
- FR29–31 (Cost): Covered by `cost` column + `ChipSelector.tsx` + filter support
- FR32–34 (Complexity): Covered by `complexity` column + select dropdown in form
- FR35–37 (Enrichment UX): Covered by `ShimmerBlock.tsx` + `useEnrichmentPolling` + status endpoint
- FR38–39 (Demo Mode): Covered by modified `cron/demo-reset` with v3 seed data
- FR40–42 (PWA): Covered by `public/manifest.json` + `<link rel="manifest">` in layout

**Non-Functional Requirements Coverage:**
- Performance: Save <500ms (enrichment async via `waitUntil`); tag autocomplete <100ms (client-side preloaded list); carousels via `Promise.all()` for parallel queries
- Security: OpenAI API key server-side only in `lib/openai.ts`; generated images proxied through OVH (no DALL-E URLs exposed)
- Reliability: 3-attempt retry with exponential backoff; image failure independent of metadata; graceful degradation on OpenAI outage
- Integration: Pinned OpenAI model version in `lib/openai.ts`; Zod schema validation before DB persist

### Implementation Readiness Validation ✅

**Decision Completeness:**
- All critical decisions documented with specific versions (GPT-4o-mini, DALL-E 3, Zod v4, Next.js 16)
- Implementation patterns comprehensive for all 8 conflict points
- Consistency rules clear with concrete code examples for each pattern
- Anti-patterns documented for each rule

**Structure Completeness:**
- Complete project tree with every new/modified file identified
- Clear annotation of NEW vs MODIFIED vs unchanged files
- Server/Client component boundary table defined
- Integration points mapped between all components

**Pattern Completeness:**
- All enrichment pipeline steps specified with exact flow
- Tag CRUD patterns defined (replace-all, join-based queries)
- Status transition rules documented with ownership constraints
- "Fill empty only" logic location and implementation specified

### Gap Analysis Results

**Gap 1 (Important) — `regenerateImage()` function:** RESOLVED
The "Régénérer" button in `PhotoManager.tsx` needs a dedicated `regenerateImage(id)` function in `lib/enrichment.ts` that only re-runs the DALL-E 3 + OVH upload pipeline without re-running metadata enrichment. This is distinct from `enrichRecipe(id)`.

**Action:** `lib/enrichment.ts` exports two functions:
- `enrichRecipe(id)` — full pipeline (metadata + image)
- `regenerateImage(id)` — image-only pipeline (DALL-E 3 → download → OVH → persist)

**Gap 2 (Important) — Tag "fill empty only" special handling:** RESOLVED
Tags are relational (junction table), so the "fill empty only" check can't use a simple null check. Instead, `lib/enrichment.ts` checks `recipe_tags` row count: if count > 0, skip AI tag assignment; if count === 0, insert AI-selected tags.

**Action:** "Fill empty only" logic in `lib/enrichment.ts` uses:
- Scalar fields: `if (!current.fieldName)` (null/undefined check)
- Tags: `if (existingTagCount === 0)` (junction table row count check)

**No critical gaps identified. No nice-to-have gaps warranting documentation.**

### Validation Issues Addressed

All issues found during validation were Important-level and have been resolved inline (Gaps 1 and 2 above). No critical or blocking issues were identified.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (brownfield v3 overlay on existing v2)
- [x] Scale and complexity assessed (Low — standard web patterns)
- [x] Technical constraints identified (Vercel serverless, existing Supabase schema)
- [x] Cross-cutting concerns mapped (enrichment pipeline, tag system, status tracking)

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions (GPT-4o-mini, DALL-E 3, Zod v4)
- [x] Technology stack fully specified (OpenAI SDK, waitUntil, TEXT[], structured outputs)
- [x] Integration patterns defined (enrichment pipeline, image pipeline, polling)
- [x] Performance considerations addressed (async enrichment, parallel carousels, client-side autocomplete)

**✅ Implementation Patterns**
- [x] Naming conventions established (8 conflict points with rules + examples)
- [x] Structure patterns defined (centralization, boundary ownership)
- [x] Communication patterns specified (polling, status transitions)
- [x] Process patterns documented (fill empty only, retry, error handling)

**✅ Project Structure**
- [x] Complete directory structure defined (every new/modified file)
- [x] Component boundaries established (server vs client, enrichment boundary)
- [x] Integration points mapped (FR group → responsible files table)
- [x] Requirements to structure mapping complete (42 FRs → specific files)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — based on validation results

**Key Strengths:**
- Clean separation of concerns with centralized enrichment pipeline
- Brownfield-friendly: all changes are additive, no v2 patterns broken
- Explicit status tracking eliminates race conditions and ambiguous states
- "Fill empty only" preserves user agency over AI suggestions
- Image failure isolation prevents metadata loss

**Areas for Future Enhancement:**
- Service worker for offline PWA support (explicitly deferred past v3 MVP)
- WebSocket/SSE for enrichment status (polling is sufficient for single-user scale)
- Tag analytics and popularity-based sorting (post-MVP enhancement)
- Batch enrichment for existing recipes without v3 metadata

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions
- Use v2 architecture document (`_bmad-output/planning-artifacts/v2/architecture.md`) for inherited conventions

**First Implementation Priority:**
Database migration (`003_ai_enrichment.sql`) → `lib/openai.ts` → `lib/schemas/enrichment.ts` → `lib/enrichment.ts` → API route modifications → UI components
