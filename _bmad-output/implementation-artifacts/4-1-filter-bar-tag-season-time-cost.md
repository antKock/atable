# Story 4.1: Filter Bar & Category Dropdowns

Status: review

## Story

As a user,
I want a horizontal filter bar at the top of my library with category pills and a "De saison" toggle,
So that I can quickly narrow down recipes by tag, season, time, or cost.

## Acceptance Criteria

1. **FilterBar layout** — the library page renders a `FilterBar` at the top as a horizontal scrollable row of pills (32px height, 13px font, `border-radius: 9999px`) with 8px gap between pills and 12px padding. No visible scrollbar on the pill row.

2. **Filter pills** — the first pill is "De saison" (toggle, no chevron icon) (FR23). Remaining pills are category filters with chevron-down icon: Type de plat, Cuisine, Régime, Durée, Coût. Inactive pills: white bg with `--border`, dark text. Active pills: `--accent` bg (#6E7A38), white text (per mockup Screen 2). Each pill has `aria-pressed` for toggle state.

3. **"De saison" toggle** — tapping it toggles a filter that matches recipes whose `seasons` array includes the current calendar season (FR22): March-May = printemps, June-Aug = ete, Sep-Nov = automne, Dec-Feb = hiver. The pill shows active (olive) state when enabled.

4. **Category dropdown** — tapping a category pill (e.g., "Cuisine") expands a `FilterDropdown` panel below the filter bar showing all tags within that category as small chips in a bordered container. Only one dropdown is open at a time — tapping another category closes the previous. The pill shows `aria-expanded="true"` when its dropdown is open.

5. **Tag chip toggle** — within an expanded dropdown, selected tags: solid olive accent bg, white text, font-weight 600. Unselected tags: transparent bg, muted text (per mockup Screen 2). Tapping a tag chip toggles it on/off — results update instantly with no "Apply" button.

6. **Durée filter** — its dropdown shows time range options: "< 30 min", "30 min - 1h", "> 1h". Filters by the sum of prep + cook time ranges (FR28).

7. **Coût filter** — its dropdown shows cost level options (€, €€, €€€) as toggleable chips.

8. **AND/OR logic** — multiple active filters across categories use AND across categories, OR within a category (UX spec: "Search & Filter Patterns"). E.g., "Végétarien" (Régime) AND "Rapide" (Occasion) = recipes matching both.

9. **Deactivation** — tapping an active filter pill again deactivates the filter and returns the pill to inactive state. No global "reset all" button needed.

## Tasks / Subtasks

- [x] Task 1: Create `FilterBar` component (AC: #1, #2, #9)
  - [x] New file: `src/components/recipes/FilterBar.tsx` (client component)
  - [x] Props: `tags: Tag[]`, `filters: FilterState`, `onFiltersChange`
  - [x] `FilterState` defined in `src/lib/filters.ts`
  - [x] Horizontal scrollable pill row with hidden scrollbar
  - [x] Pills: h-8, text-[13px], rounded-full, gap-2
  - [x] "De saison" toggle first (aria-pressed), category pills with chevron (aria-expanded)
  - [x] Active: bg-accent/text-accent-foreground; Inactive: border/bg-background
  - [x] Single dropdown open at a time via `openCategory` state

- [x] Task 2: Create `FilterPill` component (AC: #2)
  - [x] Inlined in FilterBar — pills rendered directly as buttons
  - [x] Toggle pills: `aria-pressed`; Category pills: `aria-expanded` + ChevronDown icon
  - [x] Chevron rotates 180° when expanded

- [x] Task 3: Create `FilterDropdown` component (AC: #4, #5, #6, #7)
  - [x] Inlined in FilterBar below pill row
  - [x] Bordered container with flex-wrap chip layout
  - [x] Selected: bg-accent font-semibold text-accent-foreground
  - [x] Unselected: text-muted-foreground
  - [x] Durée: hardcoded time range options
  - [x] Coût: hardcoded €/€€/€€€ options
  - [x] Tag categories: filtered from `allTags` by DB category

- [x] Task 4: Implement "De saison" logic (AC: #3)
  - [x] `getCurrentSeason()` in `src/lib/filters.ts`
  - [x] March-May → printemps, June-Aug → ete, Sep-Nov → automne, Dec-Feb → hiver
  - [x] Filters recipes by `seasons` array inclusion

- [x] Task 5: Implement filter state management with URL params (AC: #8, #9)
  - [x] `useSearchParams()` + `useRouter().replace()` in LibraryContent
  - [x] URL params: `season=1`, `tags=id1,id2`, `duration=lt30`, `cost=€`
  - [x] Parse on load, sync on change
  - [x] No browser history pollution (uses replace)

- [x] Task 6: Integrate FilterBar into library page (AC: #1)
  - [x] Modified `src/app/(app)/library/page.tsx`
  - [x] Fetches recipes + all tags server-side with Promise.all
  - [x] Created `LibraryContent` client component with FilterBar + search + grid
  - [x] `LibraryRecipeItem` type with metadata fields for filtering
  - [x] Auto-focus search on `?search=true` (from home redirect)

- [x] Task 7: Add i18n strings for filter UI
  - [x] Added `filters` section to `src/lib/i18n/fr.ts`
  - [x] All labels: deSaison, typeDePlat, cuisine, regime, duree, cout
  - [x] Duration options: lt30min, 30to60, gt60
  - [x] No results: filters.noResults

## Dev Notes

### Current library page

`src/app/(app)/library/page.tsx` is a server component that:
1. Fetches all recipes with tag joins
2. Renders a CSS grid of `RecipeCard variant="grid"` cards
3. Has zero filtering — all recipes displayed

This needs to be refactored to:
1. Fetch recipes + all tags server-side
2. Pass to `LibraryContent` client component
3. `LibraryContent` manages filter state and renders `FilterBar` + filtered grid

### Client-side filtering vs server-side

Since the library loads all recipes into the client anyway (via server component → client component pass), filtering should be **client-side** for instant results. Do NOT add filter params to the API route for this story — client-side filtering of the pre-loaded dataset is faster and simpler.

The `GET /api/recipes` route filter params will be added in Story 4.2 if server-side filtering proves necessary for large datasets.

### Filter state type

```typescript
type FilterState = {
  season: boolean           // "De saison" toggle
  tagIds: string[]          // selected tag UUIDs (OR within same category, AND across)
  duration: string | null   // 'lt30' | '30to60' | 'gt60' | null
  cost: string | null       // '€' | '€€' | '€€€' | null
}
```

### AND/OR filter logic

From UX spec "Search & Filter Patterns":
- **Within a category** (e.g., selecting "Italienne" AND "Française" in Cuisine): OR logic — recipe matches if it has ANY of the selected tags
- **Across categories** (e.g., "Italienne" in Cuisine AND "Végétarien" in Régime): AND logic — recipe must match at least one tag from EACH active category

Implementation:
```typescript
function matchesFilters(recipe: Recipe, filters: FilterState, tags: Tag[]): boolean {
  // Group selected tags by category
  const selectedByCategory = groupBy(
    tags.filter(t => filters.tagIds.includes(t.id)),
    t => t.category
  )

  // AND across categories: recipe must match at least one tag from each active category
  for (const [category, categoryTags] of Object.entries(selectedByCategory)) {
    const categoryTagIds = categoryTags.map(t => t.id)
    const recipeTagIds = recipe.tags.map(t => t.id)
    if (!categoryTagIds.some(id => recipeTagIds.includes(id))) return false
  }

  // Season filter
  if (filters.season) {
    const currentSeason = getCurrentSeason()
    if (!recipe.seasons.includes(currentSeason)) return false
  }

  // Duration filter
  if (filters.duration) { /* ... parse and compare ... */ }

  // Cost filter
  if (filters.cost) {
    if (recipe.cost !== filters.cost) return false
  }

  return true
}
```

### Tag categories for pills

The category pills map to tag `category` values in the DB:
- "Type de plat" → tags where `category = 'Type de plat'`
- "Cuisine" → tags where `category = 'Cuisine'`
- "Régime" → tags where `category = 'Régime alimentaire'`

Note: Durée and Coût are NOT tag categories — they filter on recipe metadata fields (`prep_time`, `cook_time`, `cost`). Their dropdowns show hardcoded options, not tags.

### Tag data needed

`FilterBar` needs all predefined tags to populate dropdowns. Fetch from Supabase:
```typescript
const { data: tags } = await supabase
  .from('tags')
  .select('id, name, category')
  .or('household_id.is.null,household_id.eq.{householdId}')
  .order('name')
```

### Existing tag categories defined in fr.ts

```typescript
tagCategories: {
  dishType: "Type de plat",
  diet: "Régime alimentaire",
  protein: "Protéine principale",
  cuisine: "Cuisine",
  occasion: "Occasion",
  features: "Caractéristiques",
}
```

The filter pills only show a subset: Type de plat, Cuisine, Régime. Protéine, Occasion, and Caractéristiques are excluded from the filter bar per the UX spec (too many pills). Users can still find these via search.

**Wait — re-read the epics.** The AC says: "Type de plat, Cuisine, Régime, Durée, Coût". So 5 category pills + "De saison" toggle = 6 pills total. No Protéine/Occasion/Caractéristiques in the filter bar.

### Mockup reference (Screen 2: Bibliothèque)

From `v3-screen-mockups.html`:
- Filter bar sits below page title, above recipe grid
- Pills are small rounded capsules in a horizontal row
- "De saison" pill is first, olive when active
- Category pills have small chevron-down icon
- Expanded dropdown: bordered panel with tag chips in a flex-wrap layout
- Selected chips are olive, unselected are transparent with muted text

### URL-based filter state

Use Next.js `useSearchParams()` to encode filter state in the URL. This enables:
- Shareable filter links
- Browser back/forward navigation through filter states
- Bookmarkable filtered views

Pattern:
```
/library?season=1&tags=uuid1,uuid2&duration=lt30&cost=€
```

Use `useRouter().replace()` (not push) to update params without adding to browser history for every filter toggle.

### Scrollbar hiding

The filter pill row needs hidden scrollbar. Reuse `scrollbar-hide` utility class from Story 3.2 (or add it here if Story 3.2 hasn't been implemented yet):
```css
.scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
.scrollbar-hide::-webkit-scrollbar { display: none; }
```

### Chevron icon

Use a simple inline SVG or the `ChevronDown` icon from `lucide-react` (already installed in the project — check `package.json`). Rotate 180° when expanded:
```tsx
<ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
```

### Project Structure Notes

- New files: `src/components/recipes/FilterBar.tsx`, `src/components/recipes/FilterDropdown.tsx`
- Modified files: `src/app/(app)/library/page.tsx`, `src/lib/i18n/fr.ts`
- New client component: `src/components/recipes/LibraryContent.tsx` (wraps FilterBar + grid)
- Alignment: follows HomeContent pattern of server page → client wrapper

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components > FilterBar]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components > FilterPill]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components > FilterDropdown]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Search & Filter Patterns]
- [Source: _bmad-output/planning-artifacts/v3-screen-mockups.html — Screen 2: Bibliothèque, filter bar]
- [Source: src/app/(app)/library/page.tsx — current library page (no filters)]
- [Source: src/lib/i18n/fr.ts — existing tagCategories strings]
- [Source: src/hooks/useRecipeSearch.ts — existing search hook pattern]
- [Source: src/components/recipes/TagChip.tsx — existing chip styling reference]
- [Source: src/types/recipe.ts — Recipe type with seasons, cost, prepTime, cookTime]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Created `FilterState` type and filter logic in `src/lib/filters.ts`
- `matchesFilters`: AND across categories, OR within category, plus season/duration/cost
- `getCurrentSeason()`: month-based season detection
- `FilterBar`: horizontal scrollable pills + inline dropdown panel
- `LibraryContent`: search + filters + grid, URL-synced filter state
- `LibraryRecipeItem` type extends `RecipeListItem` with filter-relevant metadata
- Library page fetches both recipes and tags with `Promise.all`
- 13 unit tests for `matchesFilters` and `getCurrentSeason` (season, tags, duration, cost, combinations)
- All 125 tests pass (0 regressions)

### File List

- `src/lib/filters.ts` (new) — FilterState type, matchesFilters, getCurrentSeason, constants
- `src/lib/filters.test.ts` (new) — 13 tests for filter logic
- `src/components/recipes/FilterBar.tsx` (new) — filter pills + dropdown panel
- `src/components/recipes/LibraryContent.tsx` (new) — search + filters + recipe grid
- `src/app/(app)/library/page.tsx` (modified) — fetches tags, uses LibraryContent
- `src/lib/i18n/fr.ts` (modified) — added filters section
- `src/types/recipe.ts` (modified) — added LibraryRecipeItem type

### Change Log

- 2026-03-14: Story 4.1 implementation complete — FilterBar, season/tag/duration/cost filters, URL sync
