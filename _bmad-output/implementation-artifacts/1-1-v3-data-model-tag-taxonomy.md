# Story 1.1: V3 Data Model & Tag Taxonomy

Status: review

## Story

As a developer,
I want the database schema extended with v3 tables and columns and the TypeScript types updated,
So that AI enrichment data can be stored, queried, and mapped throughout the application.

## Acceptance Criteria

1. **Migration `004_ai_enrichment.sql`** creates:
   - `tags` table: `id` (UUID PK DEFAULT gen_random_uuid()), `name` (TEXT NOT NULL), `category` (TEXT nullable), `is_predefined` (BOOLEAN NOT NULL DEFAULT false), `household_id` (UUID nullable FK → households ON DELETE CASCADE), `created_at` (TIMESTAMPTZ DEFAULT NOW()), UNIQUE(name, household_id), indexes on `household_id` and `is_predefined`
   - `recipe_tags` junction: `recipe_id` (UUID NOT NULL FK → recipes ON DELETE CASCADE), `tag_id` (UUID NOT NULL FK → tags ON DELETE CASCADE), PRIMARY KEY (recipe_id, tag_id)
   - ALTER `recipes`: add `prep_time` (TEXT), `cook_time` (TEXT), `cost` (TEXT), `complexity` (TEXT), `seasons` (TEXT[]), `image_prompt` (TEXT), `generated_image_url` (TEXT), `enrichment_status` (TEXT NOT NULL DEFAULT 'none'), `image_status` (TEXT NOT NULL DEFAULT 'none'), `last_viewed_at` (TIMESTAMPTZ), `view_count` (INTEGER NOT NULL DEFAULT 0)
   - Seed ~50+ predefined tags across 6 categories with `is_predefined = true`, `household_id = NULL`

2. **Recipe type** (`src/types/recipe.ts`) includes v3 fields: `prepTime`, `cookTime`, `cost`, `complexity`, `seasons` (string[]), `imagePrompt`, `generatedImageUrl`, `enrichmentStatus`, `imageStatus`, `lastViewedAt`, `viewCount`, `tags` changed from `string[]` to `Array<{ id: string; name: string; category: string | null }>`

3. **RecipeListItem** updated to include `generatedImageUrl`, `enrichmentStatus`, `imageStatus` for card rendering

4. **Zod schemas** (`src/lib/schemas/recipe.ts`): `RecipeCreateSchema` and `RecipeUpdateSchema` accept optional v3 metadata fields (prepTime, cookTime, cost, complexity, seasons, tags as array of tag IDs)

5. **Mapper** (`src/lib/supabase/mappers.ts`): `mapDbRowToRecipe` maps snake_case v3 columns to camelCase and flattens the nested tag join (`recipe_tags(tag_id, tags(id, name, category))`) into `tags: [{ id, name, category }]`

6. **i18n** (`src/lib/i18n/fr.ts`): French strings for all v3 labels — metadata labels (Prép., Cuisson, Coût, Difficulté), season names (Printemps, Été, Automne, Hiver), cost levels (€, €€, €€€), complexity levels (Facile, Moyen, Difficile), enrichment states, tag category names (Type de plat, Régime alimentaire, Protéine principale, Cuisine, Occasion, Caractéristiques), carousel section titles

## Tasks / Subtasks

- [x] Task 1: Create migration `supabase/migrations/004_ai_enrichment.sql` (AC: #1)
  - [x] Create `tags` table with all columns, constraints, indexes
  - [x] Create `recipe_tags` junction table
  - [x] ALTER `recipes` table with all new columns
  - [x] Seed predefined tags (see tag taxonomy below)
- [x] Task 2: Update `src/types/recipe.ts` (AC: #2, #3)
  - [x] Add `Tag` type: `{ id: string; name: string; category: string | null }`
  - [x] Update `Recipe` type with all v3 fields
  - [x] Update `RecipeListItem` with v3 card fields
  - [x] Update `RecipeFormData` with v3 editable fields
- [x] Task 3: Update `src/lib/schemas/recipe.ts` (AC: #4)
  - [x] Add v3 optional fields to `RecipeCreateSchema`
  - [x] Add v3 optional fields to `RecipeUpdateSchema`
- [x] Task 4: Update `src/lib/supabase/mappers.ts` (AC: #5)
  - [x] Extend `mapDbRowToRecipe` to map v3 snake_case columns
  - [x] Flatten nested `recipe_tags` join to `tags` array
  - [x] Handle missing tag join gracefully (default to `[]`)
- [x] Task 5: Update `src/lib/i18n/fr.ts` (AC: #6)
  - [x] Add `metadata` section with labels
  - [x] Add `seasons` section
  - [x] Add `cost` and `complexity` labels
  - [x] Add `enrichment` status labels
  - [x] Add `tagCategories` section
  - [x] Add carousel section titles

## Dev Notes

### Predefined Tag Taxonomy (~50+ tags across 6 categories)

**Type de plat:** Entrée, Plat principal, Accompagnement, Dessert, Soupe, Salade, Apéro, Petit-déjeuner, Goûter, Boisson, Sauce / Condiment, Pain / Pâtisserie

**Régime alimentaire:** Végétarien, Végan, Sans gluten, Sans lactose, Léger, Comfort food

**Protéine principale:** Poulet, Bœuf, Porc, Agneau, Poisson, Fruits de mer, Œufs, Tofu / Protéines végétales, Légumineuses

**Cuisine:** Française, Italienne, Indienne, Libanaise / Orientale, Mexicaine, Asiatique, Africaine, Américaine, Méditerranéenne, Nordique

**Occasion:** Rapide, En batch, Repas de fête, Pique-nique, Lunchbox

**Caractéristiques:** Pas cher, Facile, One-pot, Sans cuisson, Pour les enfants, À congeler

### Migration naming

The existing migrations are: `001_create_recipes.sql`, `002_household_auth.sql`, `003_add_is_seed.sql`. The new migration MUST be `004_ai_enrichment.sql`.

### Critical: `tags` column migration

The existing `recipes` table has a `tags TEXT[]` column (v1 — stored as plain string arrays). This column is used throughout the v2 codebase. For v3, tags move to a relational model (`tags` + `recipe_tags` tables). The `recipes.tags` column should be **kept for backward compatibility during migration** — it will be deprecated but not removed in this story. The new relational tags take precedence in the mapper.

**Strategy:** Keep the `tags TEXT[]` column. The mapper reads from the joined `recipe_tags` relation when available, falls back to `tags TEXT[]` when the join is absent. This allows incremental migration of existing code.

### TypeScript type change for tags

The `tags` field on `Recipe` changes from `string[]` to `Array<{ id: string; name: string; category: string | null }>`. This is a **breaking change** for all consumers. Places to update:
- `src/app/(app)/recipes/[id]/page.tsx` — detail page tag display
- `src/components/recipes/RecipeCard.tsx` — card tag display
- `src/app/(app)/home/page.tsx` — HomeContent carousel
- `src/app/(app)/library/page.tsx` — library grid
- `src/hooks/useRecipeSearch.ts` — search by tag name
- `src/components/recipes/RecipeForm.tsx` — form tag editing
- All tests that reference tags

### Existing patterns to follow

- **Snake_case → camelCase mapping** happens ONLY in `mapDbRowToRecipe` (never in route handlers or components)
- **Zod v4** — use `z.string()`, `z.array()`, etc. from `zod` (version ^4.3.6 in package.json)
- **Supabase joins** — use `.select('*, recipe_tags(tag_id, tags(id, name, category))')` pattern (Architecture: conflict point 4)
- **No `user_id` on tags** — tags are household-scoped (via `household_id`) or global (predefined, `household_id = NULL`)

### Project Structure Notes

- Migration file: `supabase/migrations/004_ai_enrichment.sql`
- Types: `src/types/recipe.ts`
- Schemas: `src/lib/schemas/recipe.ts`
- Mapper: `src/lib/supabase/mappers.ts`
- i18n: `src/lib/i18n/fr.ts`
- No new files created — all modifications to existing files plus one new migration

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Tag-Specific Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1]
- [Source: _bmad-output/planning-artifacts/prd.md#Tag System]
- [Source: supabase/migrations/001_create_recipes.sql — existing schema]
- [Source: src/types/recipe.ts — current Recipe type]
- [Source: src/lib/supabase/mappers.ts — current mapper]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- Created migration `004_ai_enrichment.sql` with `tags` table (UUID PK, name, category, is_predefined, household_id FK), `recipe_tags` junction table, 11 new columns on `recipes`, and 50 predefined tags across 6 categories.
- Updated `Recipe` type with all v3 fields; changed `tags` from `string[]` to `Tag[]` (`{ id, name, category }`).
- Updated `RecipeListItem` to include `generatedImageUrl`, `enrichmentStatus`, `imageStatus`.
- Updated `RecipeFormData` with optional v3 metadata fields.
- Updated Zod schemas with optional v3 fields and `tagIds` array for relational tag submission.
- Updated mapper to flatten nested `recipe_tags` join into `tags` array, with fallback to legacy `TEXT[]` column.
- Updated all consumers of `tags` (9 files): detail page, card, form, search hook, home page, library page, API routes, edit page.
- Updated all 4 test files to use `Tag[]` objects instead of `string[]`.
- Added i18n strings: metadata labels, seasons, cost/complexity levels, enrichment states, tag categories, carousel titles.
- All 55 tests pass, TypeScript compiles clean, Next.js build succeeds.

### Change Log

- 2026-03-14: Story 1.1 implemented — v3 data model, tag taxonomy, type system migration from string[] to Tag[]

### File List

- supabase/migrations/004_ai_enrichment.sql (new)
- src/types/recipe.ts (modified)
- src/lib/schemas/recipe.ts (modified)
- src/lib/supabase/mappers.ts (modified)
- src/lib/i18n/fr.ts (modified)
- src/components/recipes/RecipeCard.tsx (modified)
- src/app/(app)/recipes/[id]/page.tsx (modified)
- src/hooks/useRecipeSearch.ts (modified)
- src/components/recipes/RecipeForm.tsx (modified)
- src/app/(app)/home/page.tsx (modified)
- src/app/(app)/library/page.tsx (modified)
- src/app/api/recipes/route.ts (modified)
- src/app/api/recipes/[id]/route.ts (modified — no tag-specific changes, mapper handles v3)
- src/app/(app)/recipes/[id]/edit/page.tsx (no changes needed — passes recipe.tags which is now Tag[])
- src/hooks/useRecipeSearch.test.ts (modified)
- src/components/recipes/RecipeForm.test.tsx (modified)
- src/components/recipes/RecipeCard.test.tsx (modified)
- src/components/recipes/RecipeCarousel.test.tsx (modified)
