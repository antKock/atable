# Story 3.1: Carousel Data Queries & Home Page Integration

Status: review

## Story

As a user,
I want the home screen to show curated carousels populated by AI-assigned tags and metadata,
So that I can browse recipe inspiration without configuring any filters.

## Acceptance Criteria

1. **13 parallel carousel queries** — the home page server component executes 13 curated section queries via `Promise.all()` (NFR-P5: < 1.5s total). Each query returns up to 10 recipes with the fields needed by `RecipeCardCarousel` (id, title, photoUrl, generatedImageUrl, prepTime, cookTime, cost, tags).

2. **Curated section rules** — each carousel follows its query rule:

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

3. **Section ordering** — "Nouvelles" is always rendered first. Remaining sections appear in randomized order on each visit. Sections with < 1 matching recipe are not rendered.

4. **Search bar redirect** — tapping the search bar on the home page redirects to the Library page with the search input focused.

5. **French i18n** — carousel titles use the exact French titles from the curated list above, sourced from the `t` object in `fr.ts`.

## Tasks / Subtasks

- [x] Task 1: Create carousel query helper (AC: #1, #2)
  - [x] New file: `src/lib/queries/carousels.ts`
  - [x] Export `fetchCarouselSections(supabase)` that returns `CarouselSection[]`
  - [x] Define `CarouselSection` type: `{ key: string; title: string; recipes: RecipeListItem[] }`
  - [x] Reused `RecipeListItem` type for full compatibility with existing `RecipeCard` component
  - [x] Implement each query rule as a separate async function
  - [x] Tag-based queries: join `recipe_tags` → `tags` with `!inner` and filter by `tags.name`
  - [x] "Rapide" query: filters by tag "Rapide" (recommended approach from Dev Notes)
  - [x] "Cuisine du monde" query: match tags IN array of 6 cuisine names
  - [x] Execute all 13 queries with `Promise.all()` for parallelism
  - [x] Filter out sections with 0 results before returning

- [x] Task 2: Add i18n strings for carousel titles (AC: #5)
  - [x] Update `src/lib/i18n/fr.ts` — replaced `carousels` section with all 13 titles
  - [x] Keys: `nouvelles`, `recentes`, `redecouvrir`, `rapide`, `vegetarien`, `comfortFood`, `pasCher`, `apero`, `desserts`, `cuisineItalienne`, `cuisineDuMonde`, `petitDejeuner`, `boissons`
  - [x] Removed unused old keys (`recent`, `quick`, `seasonal`, `popular`)

- [x] Task 3: Refactor home page server component (AC: #1, #3)
  - [x] Modify `src/app/(app)/home/page.tsx`
  - [x] Replace current `buildCarousels()` logic with call to `fetchCarouselSections(supabase)`
  - [x] Keep the same Supabase client creation pattern
  - [x] Pass sections to `HomeContent` as `carouselSections` prop
  - [x] Remove the current tag-grouping logic that creates one carousel per tag

- [x] Task 4: Update `HomeContent` for curated carousels (AC: #3, #4)
  - [x] Modify `src/components/recipes/HomeContent.tsx`
  - [x] Accept `carouselSections: CarouselSection[]` prop
  - [x] Render "Nouvelles" section first (find by key)
  - [x] Shuffle remaining sections on mount (client-side `useMemo` with Fisher-Yates shuffle)
  - [x] Replace search bar with a tappable Link that navigates to `/library?search=true`
  - [x] Remove client-side recipe search logic from home (search moves to library)
  - [x] Keep empty state CTA when no recipes exist at all

- [x] Task 5: Update `RecipeCarousel` component props if needed (AC: #1)
  - [x] Verified `RecipeCarousel` accepts `RecipeListItem[]` — fully compatible, no changes needed
  - [x] Confirmed it still returns `null` for sections with 0 recipes

## Dev Notes

### Current home page implementation

`src/app/(app)/home/page.tsx` has a `buildCarousels()` function that:
1. Creates a "Récentes" carousel with the 12 most recent recipes
2. Groups remaining recipes by their tags — one carousel per unique tag name

This needs to be replaced entirely with the curated 13-section approach. The current approach generates too many carousels (one per tag across ~50 predefined tags).

### Carousel query complexity — time-based filtering

The "Rapide" carousel filters by total duration ≤ 30min. `prep_time` and `cook_time` are stored as text ranges like `< 10 min`, `10-20 min`, `20-30 min`, etc. You cannot sum them in SQL directly. Options:

**Recommended approach:** Use tag "Rapide" as the primary filter (enrichment already assigns it), supplemented by recipes where both `prep_time` and `cook_time` are in the ≤ 15min ranges. This avoids complex text parsing. Alternatively, just filter by tag "Rapide" alone since the AI enrichment assigns this tag reliably.

### Tag-based query pattern

For tag-based carousels, join through `recipe_tags` → `tags`:
```sql
SELECT r.* FROM recipes r
INNER JOIN recipe_tags rt ON r.id = rt.recipe_id
INNER JOIN tags t ON rt.tag_id = t.id
WHERE t.name = 'Végétarien'
ORDER BY r.created_at DESC
LIMIT 10
```

In Supabase client:
```typescript
const { data } = await supabase
  .from('recipes')
  .select('id, title, photo_url, generated_image_url, prep_time, cook_time, cost, recipe_tags!inner(tag_id, tags!inner(name))')
  .eq('recipe_tags.tags.name', 'Végétarien')
  .order('created_at', { ascending: false })
  .limit(10)
```

**Note:** The `!inner` modifier on the join is critical — it turns the join into an INNER JOIN so only recipes WITH that tag are returned.

### Multi-tag query ("Cuisine du monde")

For section 11, match any of 6 cuisine tags. Use `.in()` filter:
```typescript
.in('recipe_tags.tags.name', ['Indienne', 'Libanaise/Orientale', 'Mexicaine', 'Asiatique', 'Africaine', 'Américaine'])
```

### Select fields for carousel queries

Carousel cards only need: `id`, `title`, `photo_url`, `generated_image_url`, `prep_time`, `cook_time`, `cost`. Do NOT select full recipe data (no `ingredients`, `steps`, `image_prompt`). This keeps response payload small.

### Section randomization

Randomize on the client side, not the server. Use `useMemo` with a shuffled array (Fisher-Yates). This runs once on mount and stays stable during the session. Do NOT use `Math.random()` in server components (SSR hydration mismatch).

### Search bar redirect

The current `HomeContent` has a search bar that filters recipes client-side via `useRecipeSearch`. In the new design, the home page search bar should be a simple tappable element that navigates to `/library?search=true`. The library page will handle actual search. Remove `useRecipeSearch` import from `HomeContent`.

### HomeContent current props

`HomeContent` currently receives:
- `recipes: RecipeListItem[]` — all recipes for search
- `carousels: { title: string; recipes: RecipeListItem[] }[]` — generated carousels

This changes to:
- `carouselSections: CarouselSection[]` — curated sections from server
- `hasRecipes: boolean` — for empty state

### RecipeCard variant="carousel"

The existing `RecipeCard` with `variant="carousel"` renders: 3:2 aspect ratio, image with gradient overlay, title text, tag display. Story 3.2 will create a new `RecipeCardCarousel` component per the UX spec — this story does NOT modify `RecipeCard`. Instead, pass recipes to `RecipeCarousel` which uses the existing card.

### Supabase server client usage

Home page is a server component. Use `createServerClient()` directly:
```typescript
import { createServerClient } from '@/lib/supabase/server'
const supabase = createServerClient()
```

Do NOT use API routes for server-side data fetching.

### Household scoping

All queries must be scoped to the current household. The current home page already handles this — maintain the same pattern. Check for household ID from cookies/session.

### Performance target

All 13 queries must complete in < 1.5s total (NFR-P5). `Promise.all()` parallelism is essential. Each individual query should be fast (indexed columns: `created_at`, `last_viewed_at`, `view_count`, `cost`, and tag joins).

### Existing i18n strings

`fr.ts` already has:
```typescript
carousels: {
  recent: "Récentes",
  quick: "Prêt en 30 min",
  seasonal: "De saison",
  popular: "Populaires",
}
```

These need to be expanded to all 13 curated titles. Some existing keys may be reusable.

### Project Structure Notes

- New file: `src/lib/queries/carousels.ts` (query logic separated from page component)
- Modified files: `src/app/(app)/home/page.tsx`, `src/components/recipes/HomeContent.tsx`, `src/lib/i18n/fr.ts`
- Alignment: follows existing pattern of server-side data fetching in page.tsx, passed to client component

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Core UX — Home for discovery]
- [Source: _bmad-output/planning-artifacts/architecture.md#Carousel Query Rules]
- [Source: _bmad-output/planning-artifacts/v3-screen-mockups.html — Screen 1: Accueil]
- [Source: src/app/(app)/home/page.tsx — current buildCarousels() implementation]
- [Source: src/components/recipes/HomeContent.tsx — current client component]
- [Source: src/components/recipes/RecipeCarousel.tsx — existing carousel component]
- [Source: src/components/recipes/RecipeCard.tsx — existing card with variant="carousel"]
- [Source: src/lib/i18n/fr.ts — existing carousel strings]
- [Source: src/lib/supabase/mappers.ts — mapDbRowToRecipe pattern]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Implemented 13 curated carousel queries with `Promise.all()` parallelism
- Used `RecipeListItem` type instead of custom `CarouselRecipe` to maintain full compatibility with existing `RecipeCard` component
- "Rapide" carousel uses tag-based filtering (recommended approach) rather than time-range text parsing
- Tag-based queries use `!inner` join modifier for correct INNER JOIN filtering
- Fisher-Yates shuffle for client-side section randomization (stable per mount)
- Search bar replaced with tappable Link to `/library?search=true`
- Removed old carousel i18n keys; replaced with all 13 curated French titles
- 6 unit tests added for `fetchCarouselSections`: empty state, filtering, key ordering, i18n titles, row mapping, parallel execution
- All 95 tests pass (0 regressions)

### File List

- `src/lib/queries/carousels.ts` (new) — carousel query helper with 13 curated section queries
- `src/lib/queries/carousels.test.ts` (new) — 6 unit tests for fetchCarouselSections
- `src/lib/i18n/fr.ts` (modified) — replaced carousel i18n strings with 13 curated French titles
- `src/app/(app)/home/page.tsx` (modified) — refactored to use fetchCarouselSections, removed buildCarousels
- `src/components/recipes/HomeContent.tsx` (modified) — new curated carousels, search redirect, removed useRecipeSearch

### Change Log

- 2026-03-14: Story 3.1 implementation complete — 13 curated carousels, i18n, home page refactor, search redirect
