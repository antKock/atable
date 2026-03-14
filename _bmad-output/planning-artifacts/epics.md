---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad-output/planning-artifacts/v3-screen-mockups.html"
---

# atable - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for atable v3 (AI Enrichment), decomposing the requirements from the PRD, UX Design Specification, Architecture Decision Document, and v3 Screen Mockups into implementable stories.

## Requirements Inventory

### Functional Requirements

**AI Enrichment (FR1–FR6)**
- FR1: The system enriches a recipe with metadata (tags, seasons, prep time, cook time, complexity, cost, image prompt) via a single LLM call after each save (create or edit)
- FR2: Enrichment runs asynchronously — the recipe save response is returned immediately, and enrichment completes in the background
- FR3: The system sends the recipe's title, ingredients, and steps to GPT-4o-mini and receives a structured JSON response containing all metadata fields
- FR4: The system provides the LLM with the complete list of predefined tags, season values, and time/cost ranges so it selects only from valid options
- FR5: If enrichment fails (API error, timeout), the recipe remains saved with empty metadata fields — the user is never blocked
- FR6: The system retries failed enrichment with backoff (up to 3 attempts)

**AI Image Generation (FR7–FR12)**
- FR7: On recipe creation, the system generates a flat-illustration image via DALL-E 3 (1024x1024) using the image prompt produced by enrichment
- FR8: On recipe edit, the system does NOT automatically re-generate the image
- FR9: The user can manually trigger image re-generation from the recipe edit view
- FR10: The generated image is downloaded server-side and stored in OVH Object Storage, with the URL saved on the recipe
- FR11: The image prompt sent to DALL-E 3 combines the LLM-generated dish description with a fixed style suffix (flat realistic illustration, overhead angle, neutral background)
- FR12: If image generation fails, the recipe displays the existing placeholder or user-uploaded photo

**Tag System (FR13–FR18)**
- FR13: The system maintains a curated list of predefined tags organized by category (Type de plat, Régime alimentaire, Protéine principale, Cuisine, Occasion, Caractéristiques)
- FR14: The AI selects tags only from the predefined list — it cannot create new tags
- FR15: The user can create custom tags beyond the predefined list
- FR16: The user can add and remove tags on any recipe via a tag input with autocompletion grouped by category
- FR17: Tags display as visual chips/badges on the recipe detail view
- FR18: Carousels and filtering use tags to group and surface recipes

**Season (FR19–FR23)**
- FR19: Each recipe has a season field (multi-select: Printemps, Été, Automne, Hiver) — separate from tags
- FR20: The AI infers seasons from recipe ingredients
- FR21: The user can manually adjust the season selection on any recipe
- FR22: A "De saison" toggle filters recipes to match the current calendar season
- FR23: The "De saison" toggle is prominently placed in the filter/browsing UI

**Prep & Cook Time (FR24–FR28)**
- FR24: Each recipe has a prep time field selected from predefined ranges: < 10 min, 10-20 min, 20-30 min, 30-45 min, > 45 min
- FR25: Each recipe has a cook time field selected from predefined ranges: Aucune, < 15 min, 15-30 min, 30 min - 1h, 1h - 2h, > 2h
- FR26: The AI infers prep and cook time ranges from the recipe content
- FR27: The user can manually adjust prep and cook time on any recipe
- FR28: The UI can filter recipes by total time (sum of prep + cook ranges)

**Cost Estimation (FR29–FR31)**
- FR29: Each recipe has a cost field (€, €€, €€€) representing per-person cost
- FR30: The AI infers the cost level from the recipe ingredients
- FR31: The user can manually adjust the cost level on any recipe

**Complexity (FR32–FR34)**
- FR32: Each recipe has a complexity field (facile, moyen, difficile)
- FR33: The AI infers complexity from the recipe content
- FR34: The user can manually adjust the complexity on any recipe

**Enrichment UX (FR35–FR37)**
- FR35: The recipe detail view displays a shimmer/loading animation while enrichment is in progress
- FR36: When enrichment completes, the metadata fields update in place without requiring a page refresh
- FR37: All AI-assigned metadata fields are visually distinguishable as overridable (not locked)

**Demo Mode (FR38–FR39)**
- FR38: Demo seed data includes v3 metadata (tags, seasons, time, cost, complexity, generated images) so demo visitors experience the full v3 features
- FR39: The existing v2 demo household with 24h cron reset handles demo isolation — no local storage isolation required

**PWA (FR40–FR42)**
- FR40: The app provides a `manifest.json` enabling "Add to Home Screen" on iOS Safari and Chrome
- FR41: The app opens in standalone mode (no browser chrome) when launched from the home screen
- FR42: The manifest specifies the app name, icons, theme color, and background color consistent with the atable design system

### NonFunctional Requirements

**Performance**
- NFR-P1: Recipe save response time < 500ms (enrichment is async — save must never wait for AI)
- NFR-P2: Enrichment completion < 10s post-save (GPT-4o-mini structured output call)
- NFR-P3: Image generation completion < 30s post-save (DALL-E 3 1024x1024)
- NFR-P4: Tag autocompletion responsiveness < 100ms (client-side filtering on preloaded tag list)
- NFR-P5: Home carousels with AI tags < 1.5s (tag-based queries must not add latency)
- NFR-P6: All v1/v2 performance targets unchanged

**Security**
- NFR-S1: OpenAI API key server-side only — stored as env variable, used only in Route Handlers, never exposed to client
- NFR-S2: Generated images served via OVH Storage URLs — no direct DALL-E URLs exposed to clients
- NFR-S3: All v2 security NFRs inherited (session auth, CSRF protection, household isolation)

**Reliability**
- NFR-R1: Enrichment failure is non-blocking — recipe save succeeds regardless of enrichment outcome
- NFR-R2: Enrichment retry with backoff — up to 3 retries on transient OpenAI failures (429, 500, 503)
- NFR-R3: Image generation failure is non-blocking — recipe displays placeholder or user photo
- NFR-R4: Graceful degradation on OpenAI outage — full recipe CRUD continues, AI features degrade to empty metadata

**Integration**
- NFR-I1: OpenAI API version pinned — prevent unexpected behavior changes from model updates
- NFR-I2: Structured output validation — LLM JSON response validated against expected Zod schema before persisting
- NFR-I3: OVH Object Storage compatibility — generated images use same upload path, bucket, and URL pattern as user photos

### Additional Requirements

**From Architecture:**
- Async enrichment uses Vercel `waitUntil()` in Route Handlers (no job queue needed)
- Client enrichment detection via polling endpoint `GET /api/recipes/[id]/status` every 3s, max 60s
- Enrichment status tracked via `enrichment_status` (none → pending → enriched/failed) and `image_status` (none → pending → generated/failed) columns
- Tags stored relationally: `tags` table (with `is_predefined` flag, `category`, `household_id`) + `recipe_tags` junction table
- "Fill empty only" enrichment strategy: AI only fills fields that are null; existing values (AI-set or user-corrected) are never overwritten
- Tag "fill empty only" uses junction table row count check (count > 0 → skip AI tag assignment)
- Image pipeline: DALL-E 3 URL → server-side download → OVH upload → store URL on recipe
- Two exported functions: `enrichRecipe(id)` (full pipeline) and `regenerateImage(id)` (image-only pipeline)
- View tracking: `last_viewed_at` (TIMESTAMPTZ) + `view_count` (INTEGER) columns, updated on each detail page load
- 13 curated home carousel sections with specific query rules (see UX spec for full list)
- All OpenAI calls centralized in `lib/openai.ts`; enrichment pipeline in `lib/enrichment.ts`; enrichment Zod schema in `lib/schemas/enrichment.ts`
- Tag mutations use delete-then-insert (replace all), never diff
- New API routes: `GET /api/recipes/[id]/status`, `GET /api/tags`, `POST /api/tags`
- Recipe types and Zod schemas extended with v3 metadata fields
- DB mapper `mapDbRowToRecipe` extended to flatten tags from join

**From UX Design Specification + v3 Screen Mockups:**
- Shimmer variants: `rect` (metadata values ~50×16px), `pill` (tags, varying widths), `image` (4:3 hero block) — with 1.5s sweep cycle
- Metadata reveal: 300ms fade-in transition when enrichment completes
- Detail page metadata: 2×2 CSS grid (`grid-template-columns: auto 1fr auto 1fr`): Prép./value | Cuisson/value | Coût/value | Difficulté/value
- Tags + season badges placed at bottom of detail page after divider, flowing together in a single wrapping row
- Carousel cards: 3:2 aspect ratio image + gradient overlay bottom → recipe name + "duration · €" info line (no icons, plain text)
- Library grid cards: 3:4 aspect ratio image + recipe name below
- Detail hero: 4:3 aspect ratio image with frosted glass back/edit/delete buttons
- Filter bar: horizontal scrollable pills (32px height, 13px font, pill-shaped). "De saison" first (toggle, no chevron). Category pills with chevron-down: Type de plat, Cuisine, Régime, Durée, Coût
- Filter dropdown: bordered container with tag chips (`.on`: solid olive, white text, font-weight 600; `.off`: transparent, muted text). One dropdown open at a time. Results update instantly (no Apply button)
- Edit form field order: Titre → Photo (4:3 preview + 3 frosted CTAs: Régénérer/Remplacer/Supprimer) → Ingrédients → Préparation → Tags (autocomplete + chips) → Prép./Cuisson (side-by-side selects) → Coût (chip selector) → Difficulté (select) → Saisons (multi-select chips)
- No navbar in create/edit mode — fullscreen form with sticky submit at true bottom
- Home carousels: "Nouvelles" always first, remaining sections in random order per visit, section visible only if ≥1 recipe matches
- V3 design tokens: `--shimmer-base` (#E5DED6), `--shimmer-highlight` (#F0EDE8), `--tag-chip-bg` (#6E7A38/12%), `--filter-pill-active-bg` (#6E7A38), seasonal accent colors
- Tag chip: `text-xs font-medium` (12px), olive tint bg, × to remove in edit mode, read-only on detail
- Accessibility: `aria-busy="true"` on shimmer containers, `aria-live="polite"` for enrichment completion, `aria-pressed` on filter pills, `role="combobox"` on TagInput, `aria-label="Retirer le tag {name}"` on × buttons
- Generated image `alt` text derived from DALL-E prompt description
- Responsive: carousel cards 140px (mobile) / 180px (desktop); library grid 2-col mobile / 3-4-col desktop; edit form max-width ~640px centered on desktop
- Feedback pattern: AI success = silent shimmer→reveal; AI failure = silent (fields show "—" or placeholder); save success = redirect to detail (no toast)

### FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR1 | Epic 1 | AI enrichment via single LLM call after each save |
| FR2 | Epic 1 | Async enrichment — save returns immediately |
| FR3 | Epic 1 | GPT-4o-mini structured JSON response |
| FR4 | Epic 1 | LLM provided complete predefined tag/value lists |
| FR5 | Epic 1 | Enrichment failure non-blocking |
| FR6 | Epic 1 | Retry with backoff (3 attempts) |
| FR7 | Epic 1 | DALL-E 3 image generation on creation |
| FR8 | Epic 1 | No auto image re-gen on edit |
| FR9 | Epic 2 | Manual image re-generation from edit view |
| FR10 | Epic 1 | Generated image stored in OVH Object Storage |
| FR11 | Epic 1 | Image prompt = LLM description + fixed style suffix |
| FR12 | Epic 1 | Image failure fallback to placeholder/user photo |
| FR13 | Epic 1 | Curated predefined tags by category (seeded in DB) |
| FR14 | Epic 1 | AI selects only from predefined tags |
| FR15 | Epic 2 | User can create custom tags |
| FR16 | Epic 2 | Tag input with category-grouped autocompletion |
| FR17 | Epic 1 | Tags display as chips on detail view |
| FR18 | Epic 3 + Epic 4 | Tags used for carousels and filtering |
| FR19 | Epic 1 | Season multi-select field (separate from tags) |
| FR20 | Epic 1 | AI infers seasons from ingredients |
| FR21 | Epic 2 | User can manually adjust seasons |
| FR22 | Epic 4 | "De saison" toggle filters by current season |
| FR23 | Epic 4 | "De saison" toggle prominently placed in filter UI |
| FR24 | Epic 1 | Prep time predefined ranges |
| FR25 | Epic 1 | Cook time predefined ranges |
| FR26 | Epic 1 | AI infers prep/cook time |
| FR27 | Epic 2 | User can manually adjust prep/cook time |
| FR28 | Epic 4 | Filter by total time |
| FR29 | Epic 1 | Cost field (€/€€/€€€) |
| FR30 | Epic 1 | AI infers cost level |
| FR31 | Epic 2 | User can manually adjust cost |
| FR32 | Epic 1 | Complexity field (facile/moyen/difficile) |
| FR33 | Epic 1 | AI infers complexity |
| FR34 | Epic 2 | User can manually adjust complexity |
| FR35 | Epic 1 | Shimmer loading during enrichment |
| FR36 | Epic 1 | In-place metadata update without page refresh |
| FR37 | Epic 1 | AI fields visually overridable |
| FR38 | Epic 5 | Demo seed data includes v3 metadata |
| FR39 | Epic 5 | Existing v2 demo household + 24h reset |
| FR40 | Epic 5 | manifest.json for "Add to Home Screen" |
| FR41 | Epic 5 | Standalone mode from home screen |
| FR42 | Epic 5 | Manifest with app name, icons, theme color |

## Epic List

### Epic 1: AI Enrichment & Recipe Detail v3
Save a recipe and watch it organize itself — tags, seasons, time, cost, complexity, and a flat illustration appear automatically via shimmer → reveal. This is the v3 signature moment.

**FRs covered:** FR1–FR8, FR10–FR14, FR17, FR19, FR20, FR24–FR26, FR29, FR30, FR32, FR33, FR35–FR37
**NFRs addressed:** NFR-P1, NFR-P2, NFR-P3, NFR-S1, NFR-S2, NFR-R1–R4, NFR-I1–I3
**UX/Mockup references:** Screen 3 (Détail enrichi), Screen 4 (Détail shimmer)

### Epic 2: Edit Form v3 — Override AI & Photo Management
Correct any AI suggestion in the familiar edit form — remove a wrong tag in 1 tap, add the right one in 2 taps, regenerate or replace the photo, adjust any metadata field.

**FRs covered:** FR9, FR15, FR16, FR21, FR27, FR28, FR31, FR34
**NFRs addressed:** NFR-P4
**UX/Mockup references:** Screen 5 (Édition), Journey 3 (Override AI)

### Epic 3: Home Discovery Carousels
Open the app and browse curated carousels — Nouvelles, Rapide, Comfort food, Cuisine italienne, and more. The home screen feels alive with AI-populated, beautifully illustrated recipe cards.

**FRs covered:** FR18 (carousels)
**NFRs addressed:** NFR-P5, NFR-P6
**UX/Mockup references:** Screen 1 (Accueil), Journey 2 (Browse → Pick)

### Epic 4: Library Filtering
Filter your library with precision — tap "De saison" for winter dishes in January, combine "Végétarien" + "Rapide" for exactly what you need. Results update instantly.

**FRs covered:** FR18 (filtering), FR22, FR23, FR28
**NFRs addressed:** NFR-P6
**UX/Mockup references:** Screen 2 (Bibliothèque), Journey 2 (Browse → Pick)

### Epic 5: PWA & Demo Polish
Install atable on the home screen like a native app, and let visitors explore the full v3 experience in a sandboxed demo.

**FRs covered:** FR38, FR39, FR40, FR41, FR42
**UX/Mockup references:** Journey 5 (Demo Visitor), Journey 6 (PWA Install)

---

## Epic 1: AI Enrichment & Recipe Detail v3

Save a recipe and watch it organize itself — tags, seasons, time, cost, complexity, and a flat illustration appear automatically via shimmer → reveal. This is the v3 signature moment.

### Story 1.1: V3 Data Model & Tag Taxonomy

As a developer,
I want the database schema extended with v3 tables and columns and the TypeScript types updated,
So that AI enrichment data can be stored, queried, and mapped throughout the application.

**Acceptance Criteria:**

**Given** the existing v2 database schema
**When** migration `003_ai_enrichment.sql` is applied
**Then** a `tags` table exists with columns: `id` (UUID PK), `name` (TEXT NOT NULL), `category` (TEXT nullable), `is_predefined` (BOOLEAN DEFAULT false), `household_id` (UUID nullable FK → households), `created_at` (TIMESTAMPTZ), with UNIQUE(name, household_id) and indexes on `household_id` and `is_predefined`
**And** a `recipe_tags` junction table exists with `recipe_id` + `tag_id` composite PK, both FK with ON DELETE CASCADE
**And** the `recipes` table has new columns: `prep_time` (TEXT), `cook_time` (TEXT), `cost` (TEXT), `complexity` (TEXT), `seasons` (TEXT[]), `image_prompt` (TEXT), `generated_image_url` (TEXT), `enrichment_status` (TEXT NOT NULL DEFAULT 'none'), `image_status` (TEXT NOT NULL DEFAULT 'none'), `last_viewed_at` (TIMESTAMPTZ), `view_count` (INTEGER DEFAULT 0)
**And** ~50+ predefined tags are seeded across 6 categories (Type de plat, Régime alimentaire, Protéine principale, Cuisine, Occasion, Caractéristiques) with `is_predefined = true` and `household_id = NULL`

**Given** the existing `Recipe` type in `src/types/recipe.ts`
**When** the type is updated
**Then** it includes v3 fields: `prepTime`, `cookTime`, `cost`, `complexity`, `seasons` (string[]), `imagePrompt`, `generatedImageUrl`, `enrichmentStatus`, `imageStatus`, `lastViewedAt`, `viewCount`, and `tags` (array of `{ id, name, category }`)

**Given** the existing Zod schemas in `src/lib/schemas/recipe.ts`
**When** updated for v3
**Then** `RecipeCreateSchema` and `RecipeUpdateSchema` accept optional v3 metadata fields

**Given** the existing `mapDbRowToRecipe` in `src/lib/supabase/mappers.ts`
**When** a DB row with v3 columns and joined `recipe_tags(tag_id, tags(id, name, category))` is mapped
**Then** snake_case v3 columns map to camelCase TypeScript fields, and the nested tag join is flattened to `tags: [{ id, name, category }]`

**Given** the i18n file `src/lib/i18n/fr.ts`
**When** updated for v3
**Then** French strings exist for all v3 UI labels: metadata labels (Prép., Cuisson, Coût, Difficulté), season names, cost levels, complexity levels, enrichment states, and tag category names

### Story 1.2: OpenAI Client & Enrichment Pipeline

As a developer,
I want a centralized enrichment pipeline that calls GPT-4o-mini for metadata extraction and DALL-E 3 for image generation,
So that recipes can be automatically enriched with tags, seasons, time, cost, complexity, and a flat illustration.

**Acceptance Criteria:**

**Given** the `OPENAI_API_KEY` environment variable is set
**When** `lib/openai.ts` is imported
**Then** it exports an OpenAI client singleton and is the ONLY file that imports the `openai` SDK

**Given** `lib/schemas/enrichment.ts`
**When** the enrichment Zod schema is defined
**Then** it specifies the expected GPT-4o-mini structured output: `tags` (array of tag names from predefined list, max 10), `seasons` (array from [printemps, ete, automne, hiver]), `prepTime` (from predefined ranges), `cookTime` (from predefined ranges), `cost` (€/€€/€€€), `complexity` (facile/moyen/difficile), `imagePrompt` (dish visual description for DALL-E)
**And** this schema is used both for `zodResponseFormat` and server-side `.parse()` validation (FR3, FR4, NFR-I2)

**Given** a recipe with title, ingredients, and steps exists in the DB
**When** `enrichRecipe(id)` from `lib/enrichment.ts` is called
**Then** it reads the recipe, sends title + ingredients + steps to GPT-4o-mini with the predefined tag list in the system prompt, validates the structured JSON response against the Zod schema (FR3, FR4)
**And** applies "fill empty only" logic: only null scalar fields are updated; tags are only inserted if `recipe_tags` count === 0 (Architecture: fill-empty-only)
**And** sets `enrichment_status = 'enriched'` on success

**Given** enrichment succeeds and the recipe is a new creation (not edit)
**When** image generation runs
**Then** the `imagePrompt` from GPT-4o-mini is combined with a fixed style suffix ("flat realistic illustration, overhead angle, neutral background") and sent to DALL-E 3 (1024×1024) (FR7, FR11)
**And** the generated image is downloaded server-side and uploaded to OVH Object Storage using the existing photo upload pattern (FR10, NFR-S2)
**And** `generated_image_url` is stored on the recipe and `image_status = 'generated'`

**Given** enrichment succeeds and the recipe is an edit (not creation)
**When** the pipeline runs
**Then** image generation is NOT triggered automatically (FR8)

**Given** the GPT-4o-mini or DALL-E 3 call fails
**When** a transient error occurs (429, 500, 503)
**Then** the system retries with exponential backoff up to 3 attempts (FR6, NFR-R2)
**And** after 3 failures, `enrichment_status = 'failed'` and/or `image_status = 'failed'` (FR5, NFR-R1, NFR-R3)
**And** the recipe remains saved with whatever fields were already populated

**Given** `lib/enrichment.ts`
**When** image-only re-generation is needed
**Then** it exports `regenerateImage(id)` which runs ONLY the DALL-E 3 → download → OVH upload pipeline without re-running metadata enrichment (Architecture gap 1)

### Story 1.3: Async Enrichment Trigger & Status Polling

As a user,
I want recipe enrichment to happen automatically after I save without slowing down the save,
So that my recipe is immediately visible and metadata appears moments later.

**Acceptance Criteria:**

**Given** a user submits a new recipe via `POST /api/recipes`
**When** the recipe is saved to the database
**Then** `enrichment_status` is set to `'pending'` and `image_status` is set to `'pending'`
**And** `waitUntil(enrichRecipe(id))` is called to run enrichment in the background (Architecture: waitUntil pattern)
**And** the HTTP response (201) is returned immediately with the saved recipe — save latency < 500ms (FR2, NFR-P1)

**Given** a user updates a recipe via `PUT /api/recipes/[id]`
**When** the recipe is saved
**Then** `enrichment_status` is set to `'pending'` (image_status unchanged — no auto image re-gen on edit)
**And** `waitUntil(enrichRecipe(id))` is called
**And** the HTTP response (200) is returned immediately (FR2, NFR-P1)

**Given** `GET /api/recipes/[id]` is called
**When** the recipe is fetched
**Then** the response includes all v3 metadata fields AND tags via Supabase join `.select('*, recipe_tags(tag_id, tags(id, name, category))')` (Architecture: conflict point 4)

**Given** a new API route `GET /api/recipes/[id]/status`
**When** called with a valid recipe ID
**Then** it returns `{ enrichmentStatus, imageStatus }` from the recipe row (FR35)

**Given** the `useEnrichmentPolling` hook in `src/hooks/useEnrichmentPolling.ts`
**When** initialized with a recipe ID where `enrichmentStatus === 'pending'` or `imageStatus === 'pending'`
**Then** it polls `GET /api/recipes/[id]/status` every 3 seconds
**And** stops when `enrichmentStatus ∈ ['enriched', 'failed']` AND `imageStatus ∈ ['generated', 'failed', 'none']`
**And** triggers `router.refresh()` on status change to re-fetch Server Component data (FR36)
**And** has a max polling duration of 60 seconds as safety cutoff

### Story 1.4: Recipe Detail Page v3

As a user,
I want to see my recipe's AI-generated metadata, tags, seasons, and illustration on the detail page with a smooth shimmer → reveal animation,
So that I can immediately appreciate how the app organized my recipe.

**⚠️ CRITICAL: Implementation MUST match `v3-screen-mockups.html` (Screen 3: Détail enrichi, Screen 4: Détail shimmer) and UX Design Specification (sections: Design Direction Mockups, Component Strategy, Visual Design Foundation) in layout, spacing, and visual hierarchy.**

**Acceptance Criteria:**

**Given** a recipe detail page loads with `enrichment_status === 'pending'`
**When** the page renders
**Then** the hero image area shows a shimmer block (4:3 aspect ratio per mockup Screen 4)
**And** the MetadataGrid shows labels ("Prép.", "Cuisson", "Coût", "Difficulté") visible with shimmer rects where values will appear — aligned per the 2×2 CSS grid layout (`grid-template-columns: auto 1fr auto 1fr`) from UX spec section "Screen 3: Détail (enrichi)"
**And** the tags area shows shimmer pills of varying widths (per mockup Screen 4)
**And** title, ingredients, and steps are fully visible (never shimmered — they are user-entered content)
**And** the `useEnrichmentPolling` hook is active

**Given** enrichment completes (`enrichment_status` changes to `'enriched'`)
**When** `router.refresh()` fires
**Then** shimmer blocks fade out and real metadata fades in with 300ms transition (UX spec: "Experience Mechanics")
**And** tags appear as olive-tinted TagChip components (read-only, no × button) with `--tag-chip-bg` (#6E7A38/12%) and `text-xs font-medium` (UX spec: "Custom Components > TagChip")
**And** season badges appear using SeasonBadge component with optional seasonal accent colors
**And** tags + season badges are placed after a divider at the bottom, flowing together in a single wrapping row (per mockup Screen 3)

**Given** image generation completes (`image_status` changes to `'generated'`)
**When** the page updates
**Then** the hero shimmer block fades to the generated flat illustration with 300ms transition
**And** the generated image has `alt` text derived from the image prompt (UX spec: Accessibility)

**Given** enrichment fails (`enrichment_status === 'failed'`)
**When** the page renders
**Then** metadata fields show "—" for null values, and the image shows the existing placeholder or user-uploaded photo (UX spec: "Empty & Loading States" — no error message, no toast) (FR5, FR12)

**Given** the ShimmerBlock component
**When** rendered
**Then** it supports variants: `rect` (~50×16px for metadata values), `pill` (varying widths for tags), `image` (4:3 block for hero)
**And** uses 1.5s shimmer sweep cycle with `--shimmer-base` (#E5DED6) and `--shimmer-highlight` (#F0EDE8) (UX spec: "Custom Components > ShimmerBlock")
**And** container has `aria-busy="true"` and enrichment completion is announced via `aria-live="polite"` region

**Given** the detail page hero section
**When** rendered
**Then** the image uses 4:3 aspect ratio with frosted glass back/edit/delete buttons overlaid (`rgba(255,255,255,0.85)`, `backdrop-filter: blur(6px)`) — matching mockup Screen 3 exactly

**Given** a user views a recipe detail page
**When** the page loads
**Then** `last_viewed_at` is updated to current timestamp and `view_count` is incremented by 1

**Given** v3 design tokens
**When** implemented in `globals.css`
**Then** CSS variables are defined: `--shimmer-base`, `--shimmer-highlight`, `--tag-chip-bg`, `--tag-chip-text`, `--season-spring`, `--season-summer`, `--season-autumn`, `--season-winter`, `--reveal-duration`

---

## Epic 2: Edit Form v3 — Override AI & Photo Management

Correct any AI suggestion in the familiar edit form — remove a wrong tag in 1 tap, add the right one in 2 taps, regenerate or replace the photo, adjust any metadata field.

### Story 2.1: Tag API & Tag Input Component

As a user,
I want to add and remove tags on my recipe with an autocomplete grouped by category,
So that I can correct AI-assigned tags or add my own in just a few taps.

**⚠️ CRITICAL: Implementation MUST match `v3-screen-mockups.html` (Screen 5: Édition — tags section) and UX Design Specification (sections: "Custom Components > TagInput", "Custom Components > TagChip").**

**Acceptance Criteria:**

**Given** a new API route `GET /api/tags`
**When** called with a valid household session
**Then** it returns all predefined tags (household_id IS NULL) plus all custom tags for the current household, grouped by category

**Given** a new API route `POST /api/tags`
**When** called with `{ name }` and no matching predefined tag exists
**Then** a new custom tag is created with `is_predefined = false`, `household_id` set to the current household, `category = null`
**And** the created tag is returned (FR15)

**Given** the TagInput component in the edit form
**When** the user types in the input field
**Then** a dropdown appears showing matching tags filtered by the typed text, grouped by category headers (Type de plat, Régime, Protéine, Cuisine, Occasion, Caractéristiques) (FR16)
**And** filtering is client-side on a preloaded tag list — responsiveness < 100ms (NFR-P4)
**And** the component uses `role="combobox"`, `aria-expanded`, `aria-activedescendant` for keyboard navigation

**Given** no matching predefined tag exists for the typed text
**When** the user types a custom tag name
**Then** a "Créer '{input}'" option appears at the bottom of the dropdown
**And** selecting it calls `POST /api/tags` to create the custom tag, then adds it to the recipe (FR15)

**Given** a TagChip in editable mode (edit form)
**When** the user taps the × button on a tag chip
**Then** the tag is removed from the recipe's tag list (1 tap to remove)
**And** the × button has `aria-label="Retirer le tag {name}"`

**Given** tag mutations on save
**When** the recipe is saved with updated tags
**Then** tags are persisted using delete-then-insert (replace all) pattern on `recipe_tags` table (Architecture: conflict point 5)

### Story 2.2: V3 Metadata Fields in Edit Form

As a user,
I want to manually adjust prep time, cook time, cost, complexity, and seasons in the edit form,
So that I can correct any AI-inferred values that don't match my recipe.

**⚠️ CRITICAL: Implementation MUST match `v3-screen-mockups.html` (Screen 5: Édition — full field order) and UX Design Specification (section: "Screen 5: Édition (Edit Form)", "Form Patterns").**

**Acceptance Criteria:**

**Given** the edit form field order
**When** rendered
**Then** fields appear in this exact order: Titre → Photo → Ingrédients → Préparation → Tags → Prép./Cuisson → Coût → Difficulté → Saisons (per UX spec: "Screen 5: Édition")
**And** there is no divider between Tags and the metadata fields — they flow as one continuous form
**And** the form has no navbar (fullscreen mode) with a sticky submit button at the true bottom

**Given** the Prép. and Cuisson fields
**When** rendered in the edit form
**Then** they appear as side-by-side select dropdowns (`grid-template-columns: 1fr 1fr`, 12px gap per UX spec "Form Patterns")
**And** Prép. options: < 10 min, 10-20 min, 20-30 min, 30-45 min, > 45 min (FR24, FR27)
**And** Cuisson options: Aucune, < 15 min, 15-30 min, 30 min - 1h, 1h - 2h, > 2h (FR25, FR27)

**Given** the Coût field
**When** rendered in the edit form
**Then** it appears as a ChipSelector component with three options: €, €€, €€€ (single-select)
**And** selected chip: olive accent bg (`--accent`), white text. Unselected: transparent bg, border, muted text (per mockup Screen 5) (FR31)
**And** each chip has `aria-pressed` state

**Given** the Difficulté field
**When** rendered in the edit form
**Then** it appears as a select dropdown with options: Facile, Moyen, Difficile (FR34)

**Given** the Saisons field
**When** rendered in the edit form
**Then** it appears as a multi-select ChipSelector with four options: Printemps, Été, Automne, Hiver (FR21)
**And** multiple seasons can be selected simultaneously
**And** chip on/off states match the Coût chip styling

**Given** the ChipSelector component
**When** used for both Coût (single-select) and Saisons (multi-select)
**Then** it uses `role="group"` on the container and `aria-pressed` on each chip
**And** keyboard Enter/Space toggles chip state

**Given** the edit form is opened for an existing recipe
**When** it renders
**Then** all v3 metadata fields are pre-filled with current values (AI-set or previously user-corrected)

**Given** the user saves the form with modified metadata
**When** the PUT request is sent
**Then** user-set values are persisted, and subsequent enrichment respects "fill empty only" — these values are never overwritten by AI

### Story 2.3: Photo Manager — Regenerate, Replace & Remove

As a user,
I want to regenerate the AI illustration, replace it with my own photo, or remove it entirely from the edit form,
So that every recipe has the image that best represents the dish.

**⚠️ CRITICAL: Implementation MUST match `v3-screen-mockups.html` (Screen 5: Édition — photo section) and UX Design Specification (section: "Custom Components > PhotoManager").**

**Acceptance Criteria:**

**Given** the PhotoManager component in the edit form
**When** a recipe has a photo (user-uploaded or AI-generated)
**Then** it displays a 4:3 image preview with 3 frosted-glass action buttons below/overlaid: Régénérer (with refresh icon), Remplacer, Supprimer
**And** buttons use frosted glass styling: `rgba(255,255,255,0.85)`, `backdrop-filter: blur(6px)`, 12px font (per UX spec "Button Hierarchy > Photo action")

**Given** the user taps "Régénérer"
**When** the form is saved
**Then** `regenerateImage(id)` is called via `waitUntil()` — a new DALL-E 3 image is generated using the current recipe content, downloaded, and uploaded to OVH (FR9)
**And** the image slot shows shimmer while generation is in progress
**And** the old generated image URL is replaced by the new one

**Given** the user taps "Remplacer"
**When** the device file picker opens
**Then** the user can select a photo from their device
**And** the uploaded photo replaces the current image (same upload flow as existing v2 photo upload)
**And** the preview updates immediately to show the selected photo

**Given** the user taps "Supprimer"
**When** confirmed
**Then** the photo is removed from the recipe (both `photo_url` and `generated_image_url` cleared)
**And** the PhotoManager switches to the "no photo" state showing an upload/generate prompt

**Given** the PhotoManager with no photo
**When** rendered
**Then** it shows an upload prompt (placeholder state) allowing the user to add a photo from their device

**Given** photo actions
**When** any action is taken
**Then** each button has a descriptive accessible label, and the file input is keyboard-accessible

---

## Epic 3: Home Discovery Carousels

Open the app and browse curated carousels — Nouvelles, Rapide, Comfort food, Cuisine italienne, and more. The home screen feels alive with AI-populated, beautifully illustrated recipe cards.

### Story 3.1: Carousel Data Queries & Home Page Integration

As a user,
I want the home screen to show curated carousels populated by AI-assigned tags and metadata,
So that I can browse recipe inspiration without configuring any filters.

**Acceptance Criteria:**

**Given** the home page server component
**When** it loads
**Then** it executes 13 parallel carousel queries via `Promise.all()` (NFR-P5: < 1.5s total)
**And** each query follows the curated section rules from the UX spec:

| # | Section title | Query rule |
|---|---|---|
| 1 | Nouvelles | 10 most recent by `created_at` |
| 2 | Récentes | 10 most recent by `last_viewed_at` (non-null only) |
| 3 | Redécouvrir | Lowest `view_count`, excluding recipes never viewed (`view_count = 0`) |
| 4 | Rapide | Total duration ≤ 30min OR tag "Rapide" |
| 5 | Végétarien | Tag "Végétarien" |
| 6 | Comfort food | Tag "Comfort food" |
| 7 | Pas cher | `cost = '€'` |
| 8 | Apéro | Tag "Apéro" |
| 9 | Desserts | Tag "Dessert" |
| 10 | Cuisine italienne | Tag "Italienne" |
| 11 | Cuisine du monde | Tags IN [Indienne, Libanaise/Orientale, Mexicaine, Asiatique, Africaine, Américaine] |
| 12 | Petit-déjeuner | Tag "Petit-déjeuner" |
| 13 | Boissons | Tag "Boisson" |

**And** "Nouvelles" is always rendered first
**And** remaining sections appear in randomized order on each visit
**And** sections with < 1 matching recipe are not rendered

**Given** the search bar on the home page
**When** the user taps it
**Then** they are redirected to the Library page with the search input focused

**Given** French i18n strings
**When** carousel titles are rendered
**Then** they use the exact French titles from the curated list above (via `t` object from `fr.ts`)

### Story 3.2: Recipe Card Carousel Component

As a user,
I want visually rich recipe cards in the home carousels with images, names, and quick info,
So that I can browse and pick a recipe at a glance.

**⚠️ CRITICAL: Implementation MUST match `v3-screen-mockups.html` (Screen 1: Accueil — carousel cards) and UX Design Specification (sections: "Custom Components > RecipeCardCarousel", "Custom Components > CarouselSection").**

**Acceptance Criteria:**

**Given** the CarouselSection component
**When** rendered for a section with ≥ 1 recipe
**Then** it shows the section title as plain text (no icons), `text-lg font-semibold` (18px) per UX spec "Typography System"
**And** below it a horizontally scrollable row of RecipeCardCarousel items
**And** the scroll container uses `overflow-x: auto` with no visible scrollbar, gap between cards
**And** the section has `role="region"` and `aria-label="Section {title}"`

**Given** the RecipeCardCarousel component
**When** rendered
**Then** it shows a 3:2 aspect ratio image (140px wide on mobile, 180px on desktop per UX spec "Responsive Design")
**And** the image is the recipe's user photo, generated illustration, or placeholder (in that priority order)
**And** a gradient overlay at the bottom ensures text readability
**And** recipe name appears over the gradient in white
**And** below the name, a subtitle line shows "duration · €" (e.g., "30 min · €") — plain text, no icons (per mockup Screen 1)
**And** the entire card is a tappable link to the recipe detail page with `aria-label` containing the recipe name

**Given** a carousel card is tapped/pressed
**When** the user interacts
**Then** subtle scale-down feedback is visible (pressed state)

---

## Epic 4: Library Filtering

Filter your library with precision — tap "De saison" for winter dishes in January, combine "Végétarien" + "Rapide" for exactly what you need. Results update instantly.

### Story 4.1: Filter Bar & Category Dropdowns

As a user,
I want a horizontal filter bar at the top of my library with category pills and a "De saison" toggle,
So that I can quickly narrow down recipes by tag, season, time, or cost.

**⚠️ CRITICAL: Implementation MUST match `v3-screen-mockups.html` (Screen 2: Bibliothèque — filter bar and expanded panel) and UX Design Specification (sections: "Custom Components > FilterBar", "Custom Components > FilterPill", "Custom Components > FilterDropdown", "Search & Filter Patterns").**

**Acceptance Criteria:**

**Given** the library page
**When** it renders
**Then** a FilterBar appears at the top as a horizontal scrollable row of pills (32px height, 13px font, `border-radius: 9999px`) with 8px gap between pills and 12px padding
**And** no visible scrollbar on the pill row

**Given** the filter pills
**When** rendered
**Then** the first pill is "De saison" (toggle, no chevron icon) (FR23)
**And** remaining pills are category filters with chevron-down icon: Type de plat, Cuisine, Régime, Durée, Coût
**And** inactive pills: white bg with `--border`, dark text. Active pills: `--accent` bg (#6E7A38), white text (per mockup Screen 2)
**And** each pill has `aria-pressed` for toggle state

**Given** the "De saison" pill
**When** tapped
**Then** it toggles a filter that matches recipes whose `seasons` array includes the current calendar season (FR22): March-May = printemps, June-Aug = ete, Sep-Nov = automne, Dec-Feb = hiver
**And** the pill shows active (olive) state when enabled

**Given** a category pill (e.g., "Cuisine")
**When** tapped
**Then** a FilterDropdown panel expands below the filter bar showing all tags within that category as small chips in a bordered container
**And** only one dropdown is open at a time — tapping another category closes the previous
**And** the pill shows `aria-expanded="true"` when its dropdown is open

**Given** tags within an expanded FilterDropdown
**When** rendered
**Then** selected tags (`.on`): solid olive accent bg, white text, font-weight 600
**And** unselected tags (`.off`): transparent bg, muted text (per mockup Screen 2)
**And** tapping a tag chip toggles it on/off — results update instantly with no "Apply" button

**Given** the Durée filter pill
**When** its dropdown expands
**Then** it shows time range options (e.g., "< 30 min", "30 min - 1h", "> 1h") that filter by the sum of prep + cook time ranges (FR28)

**Given** the Coût filter pill
**When** its dropdown expands
**Then** it shows cost level options (€, €€, €€€) as toggleable chips

**Given** multiple active filters across categories
**When** the user selects "Végétarien" (Régime) AND "Rapide" (tag or Durée)
**Then** results show recipes matching ALL selected filters (AND across categories, OR within a category) (UX spec: "Search & Filter Patterns")

**Given** an active filter pill
**When** tapped again
**Then** the filter is deactivated and the pill returns to inactive state (no global "reset all" button needed)

### Story 4.2: Library Grid & Filtered Results

As a user,
I want the library to display filtered recipes in a responsive grid with rich recipe cards,
So that I can visually scan and pick the right recipe.

**⚠️ CRITICAL: Implementation MUST match `v3-screen-mockups.html` (Screen 2: Bibliothèque — recipe grid) and UX Design Specification (sections: "Custom Components > RecipeCardGrid", "Responsive Design").**

**Acceptance Criteria:**

**Given** the library page with active filters
**When** recipes are fetched
**Then** the `GET /api/recipes` route accepts filter query params for tags (array), seasons, time range, and cost level
**And** the query filters recipes matching the active filter combination
**And** results include v3 metadata and tags via Supabase join

**Given** the RecipeCardGrid component
**When** rendered
**Then** it shows recipe cards in a 2-column grid on mobile, 3-4 columns on desktop (per UX spec "Responsive Design")
**And** each card has a 3:4 aspect ratio image with recipe name below the image (per mockup Screen 2)
**And** the image is the recipe's user photo, generated illustration, or placeholder
**And** the entire card is a tappable link to the recipe detail page

**Given** filter state
**When** filters change
**Then** the URL params are updated to reflect current filters (shareable filter state)
**And** navigating to a library URL with filter params pre-activates those filters

**Given** no recipes match the active filters
**When** the grid renders
**Then** an empty state message "Aucune recette trouvée" is shown with a suggestion to adjust filters (UX spec: "Empty & Loading States")

**Given** the library page header
**When** rendered
**Then** it shows the library title per the mockup Screen 2 layout

---

## Epic 5: PWA & Demo Polish

Install atable on the home screen like a native app, and let visitors explore the full v3 experience in a sandboxed demo.

### Story 5.1: PWA Manifest

As a user,
I want to add atable to my home screen and have it open in standalone mode like a native app,
So that I can access my recipes without browser chrome.

**Acceptance Criteria:**

**Given** `public/manifest.json`
**When** created
**Then** it contains: `name: "À Table"`, `short_name: "À Table"`, `display: "standalone"`, `start_url: "/home"`, `theme_color: "#F8FAF7"`, `background_color: "#F8FAF7"` (FR40, FR41, FR42)
**And** icons array includes 192×192 and 512×512 PNG icons (maskable) (FR42)

**Given** the root layout `src/app/layout.tsx`
**When** rendered
**Then** it includes `<link rel="manifest" href="/manifest.json">` in the head

**Given** a user adds atable to their home screen on iOS Safari
**When** they launch it from the home screen
**Then** the app opens in standalone mode (no browser URL bar or chrome) with the warm white status bar (FR41)

### Story 5.2: Demo Seed Data & Cron Reset v3

As a demo visitor,
I want the demo library to showcase the full v3 experience with AI-enriched recipes,
So that I can understand the product's value before creating my own household.

**Acceptance Criteria:**

**Given** the demo seed data
**When** updated for v3
**Then** demo recipes include v3 metadata: tags (linked via `recipe_tags`), seasons, prep_time, cook_time, cost, complexity, and `generated_image_url` pointing to pre-generated DALL-E illustrations stored in OVH (FR38)
**And** the demo library showcases enough enriched recipes (≥ 10) to populate multiple home carousels

**Given** the existing cron demo-reset route `api/cron/demo-reset/route.ts`
**When** it runs (every 24h)
**Then** it resets the demo household's recipes to the seed state including all v3 metadata
**And** it cleans up `recipe_tags` entries for the demo household
**And** it removes any non-seed generated images from OVH storage for the demo household (FR39)

**Given** a demo visitor
**When** they browse the demo
**Then** home carousels are populated, "De saison" filter works, recipe detail pages show full metadata with tags and generated images — the complete v3 experience
