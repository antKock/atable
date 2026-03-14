# Story 3.2: Recipe Card Carousel Component

Status: review

## Story

As a user,
I want visually rich recipe cards in the home carousels with images, names, and quick info,
So that I can browse and pick a recipe at a glance.

## Acceptance Criteria

1. **CarouselSection component** — when rendered for a section with ≥ 1 recipe, shows the section title as plain text (no icons), `text-lg font-semibold` (18px) per UX spec "Typography System". Below it, a horizontally scrollable row of `RecipeCardCarousel` items. Scroll container uses `overflow-x: auto` with no visible scrollbar and gap between cards. Section has `role="region"` and `aria-label="Section {title}"`.

2. **RecipeCardCarousel component** — renders a card with:
   - 3:2 aspect ratio image (140px wide on mobile, 180px on desktop per UX spec "Responsive Design")
   - Image priority: user photo → generated illustration → placeholder
   - Gradient overlay at the bottom for text readability
   - Recipe name over the gradient in white
   - Subtitle line: "duration · €" (e.g., "30 min · €") — plain text, no icons (per mockup Screen 1)
   - Entire card is a tappable link to `/recipes/[id]` with `aria-label` containing the recipe name

3. **Press feedback** — when a carousel card is tapped/pressed, subtle scale-down feedback is visible (pressed state via `active:scale-95` or similar).

## Tasks / Subtasks

- [x] Task 1: Create `RecipeCardCarousel` component (AC: #2, #3)
  - [x] New file: `src/components/recipes/RecipeCardCarousel.tsx`
  - [x] Props: `recipe: CarouselRecipeItem` (extends RecipeListItem with prepTime, cookTime, cost)
  - [x] Render as `<Link href={/recipes/${recipe.id}}>` wrapping the card
  - [x] Image: `next/image` with `fill`, `object-cover`, 3:2 aspect ratio container
  - [x] Image source logic: `recipe.photoUrl ?? recipe.generatedImageUrl`
  - [x] Fallback: warm gradient placeholder using `getRecipePlaceholderGradient`
  - [x] Gradient overlay: `absolute bottom-0 bg-gradient-to-t from-black/60 to-transparent`
  - [x] Title: white text over gradient, `text-sm font-medium`, `line-clamp-2`
  - [x] Subtitle: formatted duration · cost
  - [x] Size: `w-[140px] lg:w-[180px] flex-none`
  - [x] `rounded-lg overflow-hidden` with `active:scale-[0.97] transition-transform duration-100`
  - [x] `aria-label={recipe.title}`

- [x] Task 2: Create duration formatting helper (AC: #2)
  - [x] `formatDuration()` exported from `RecipeCardCarousel.tsx`
  - [x] Input: `prepTime` and `cookTime` string ranges
  - [x] Output: "30 min" or "1h15" format
  - [x] Handles `<`, `>`, range, and `Aucune` formats
  - [x] Returns `null` if both are null

- [x] Task 3: Refactor `CarouselSection` component (AC: #1)
  - [x] Modified existing `src/components/recipes/RecipeCarousel.tsx`
  - [x] Title: `text-lg font-semibold` (plain text, not capitalized)
  - [x] Scroll container: `flex overflow-x-auto gap-3` with hidden scrollbar
  - [x] `role="region"` on the section, `aria-label` via `t.a11y.carousel(title)`
  - [x] Returns `null` for empty recipes array
  - [x] Uses `RecipeCardCarousel` instead of `RecipeCard variant="carousel"`

- [x] Task 4: Add scrollbar-hiding CSS (AC: #1)
  - [x] Used Tailwind arbitrary values inline: `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`
  - [x] No globals.css changes needed — consistent with existing pattern

- [x] Task 5: Update `HomeContent` to use new components (AC: #1, #2, #3)
  - [x] `HomeContent` already uses `RecipeCarousel` which now renders `RecipeCardCarousel`
  - [x] Carousels render with new card design
  - [x] "Nouvelles" first, others randomized (from Story 3.1)

## Dev Notes

### Existing RecipeCard vs new RecipeCardCarousel

The existing `RecipeCard` with `variant="carousel"` is `w-56 lg:w-64` (224px/256px), shows tags below the title, and uses `aspect-[3/2]`. The new `RecipeCardCarousel` per the UX spec is smaller: `w-[140px] lg:w-[180px]`, shows duration + cost subtitle instead of tags, and has no tag chips. Create a new component rather than modifying the existing `RecipeCard`, which is still used by the library grid.

### Image component

Use `next/image` with `fill` inside a relative container for automatic optimization:
```tsx
<div className="relative aspect-[3/2]">
  <Image src={imageSrc} alt={recipe.title} fill className="object-cover" sizes="(min-width: 1024px) 180px, 140px" />
</div>
```

Provide `sizes` prop to hint image download size. For 140/180px cards, the image doesn't need to be larger than 360px wide (2x retina).

### Placeholder when no image

If `recipe.photoUrl` and `recipe.generatedImageUrl` are both null (recipe not yet enriched or enrichment failed), show a warm gradient:
```tsx
<div className="absolute inset-0 bg-gradient-to-br from-secondary to-border" />
```

This matches the existing `RecipeCard` fallback pattern.

### Duration formatting

`prepTime` and `cookTime` values are text ranges stored by enrichment:
- `prep_time`: `< 10 min`, `10-20 min`, `20-30 min`, `30-45 min`, `> 45 min`
- `cook_time`: `Aucune`, `< 15 min`, `15-30 min`, `30-60 min`, `> 60 min`

For display, extract the max from each range and sum:
```typescript
function parseDurationMax(range: string | null): number {
  if (!range || range === 'Aucune') return 0
  const match = range.match(/(\d+)/)
  if (range.startsWith('>')) return parseInt(match?.[1] || '60') + 15
  if (range.startsWith('<')) return parseInt(match?.[1] || '10')
  // "10-20 min" → take the upper bound
  const parts = range.match(/(\d+)-(\d+)/)
  return parts ? parseInt(parts[2]) : parseInt(match?.[1] || '0')
}

function formatDuration(prepTime: string | null, cookTime: string | null): string | null {
  const total = parseDurationMax(prepTime) + parseDurationMax(cookTime)
  if (total === 0) return null
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}
```

### Subtitle line format

Per mockup Screen 1: `"30 min · €"` — duration, then middle dot, then cost symbol. Only show parts that are available:
- Both: `"30 min · €"`
- Duration only: `"30 min"`
- Cost only: `"€"`
- Neither: empty/hidden subtitle

### Existing RecipeCarousel component

`src/components/recipes/RecipeCarousel.tsx` renders a section title + horizontal scroll. It already has `role="region"` and `aria-label`. Decide whether to refactor this component or create a new `CarouselSection`. Recommended: modify the existing component to accept `RecipeCardCarousel` children, or replace it entirely if the interface is too different.

Current props:
```typescript
{ title: string; recipes: RecipeListItem[]; renderCard?: (recipe) => ReactNode }
```

### Scrollbar hiding

The UX spec says "no visible scrollbar". Add a utility class to `globals.css`. This is a common pattern — check if `scrollbar-hide` already exists before adding.

### Press feedback

Use Tailwind's `active:` modifier for instant feedback:
```tsx
<Link className="... active:scale-[0.97] transition-transform duration-100">
```

This gives subtle scale-down on press without needing JavaScript.

### Mockup reference

Screen 1 (Accueil) in `v3-screen-mockups.html` shows:
- Carousel cards as small rectangles with image + overlaid text
- Title "Nouvelles" at top, other sections below
- Cards have rounded corners, subtle shadow
- Recipe name in white over gradient
- Small subtitle text below name

### Dependency on Story 3.1

This story depends on Story 3.1 for the carousel data (queries + `CarouselSection` type). Implement 3.1 first, then 3.2 adds the visual components.

### Project Structure Notes

- New file: `src/components/recipes/RecipeCardCarousel.tsx`
- Modified files: `src/components/recipes/RecipeCarousel.tsx` (or replaced), `src/components/recipes/HomeContent.tsx`, `src/app/globals.css`
- The existing `RecipeCard` (used by library grid) is NOT modified

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components > RecipeCardCarousel]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components > CarouselSection]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Typography System]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Responsive Design]
- [Source: _bmad-output/planning-artifacts/v3-screen-mockups.html — Screen 1: Accueil, carousel cards]
- [Source: src/components/recipes/RecipeCard.tsx — existing card with variant="carousel"]
- [Source: src/components/recipes/RecipeCarousel.tsx — existing carousel container]
- [Source: src/components/recipes/HomeContent.tsx — renders carousels]
- [Source: _bmad-output/implementation-artifacts/3-1-carousel-data-queries-home-integration.md — data layer dependency]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Created `RecipeCardCarousel` component: smaller cards (140/180px), 3:2 ratio, gradient overlay, duration·cost subtitle
- Created `CarouselRecipeItem` type extending `RecipeListItem` with prepTime, cookTime, cost metadata
- `formatDuration` helper: parses text ranges ("< 10 min", "10-20 min", "> 45 min", "Aucune"), sums max values, formats as "30 min" or "1h15"
- Refactored `RecipeCarousel` to use `RecipeCardCarousel` instead of `RecipeCard variant="carousel"`
- Updated carousel query mapper to include metadata fields
- 17 tests added for RecipeCardCarousel (9 formatDuration + 8 component)
- Updated 4 existing RecipeCarousel tests for new type
- All 112 tests pass (0 regressions)

### File List

- `src/components/recipes/RecipeCardCarousel.tsx` (new) — carousel card with duration/cost subtitle
- `src/components/recipes/RecipeCardCarousel.test.tsx` (new) — 17 tests
- `src/components/recipes/RecipeCarousel.tsx` (modified) — uses RecipeCardCarousel, role="region"
- `src/components/recipes/RecipeCarousel.test.tsx` (modified) — updated type to CarouselRecipeItem
- `src/lib/queries/carousels.ts` (modified) — added CarouselRecipeItem type, custom mapper with metadata

### Change Log

- 2026-03-14: Story 3.2 implementation complete — RecipeCardCarousel, duration formatting, carousel refactor
