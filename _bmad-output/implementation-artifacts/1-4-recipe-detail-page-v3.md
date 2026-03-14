# Story 1.4: Recipe Detail Page v3

Status: review

## Story

As a user,
I want to see my recipe's AI-generated metadata, tags, seasons, and illustration on the detail page with a smooth shimmer → reveal animation,
So that I can immediately appreciate how the app organized my recipe.

## Acceptance Criteria

1. **Shimmer loading state**: when `enrichmentStatus === 'pending'`, the page shows:
   - Hero image: shimmer block (4:3 aspect ratio)
   - MetadataGrid: labels visible ("Prép.", "Cuisson", "Coût", "Difficulté") with shimmer rects (~50×16px) where values appear — 2×2 CSS grid (`grid-template-columns: auto 1fr auto 1fr`)
   - Tags area: shimmer pills of varying widths
   - Title, ingredients, steps: fully visible (never shimmered)
   - `useEnrichmentPolling` hook active

2. **Shimmer → reveal transition**: when enrichment completes, shimmer blocks fade out and real metadata fades in with 300ms CSS transition. Tags appear as olive-tinted `TagChip` components (read-only, no × button). Season badges appear via `SeasonBadge` component. Tags + season badges placed after a divider at bottom, flowing together in a single wrapping row.

3. **Image reveal**: when `imageStatus` changes to `'generated'`, hero shimmer fades to the generated flat illustration. Alt text derived from `imagePrompt`. Falls back to placeholder gradient or user photo on failure.

4. **MetadataGrid component** (`src/components/recipes/MetadataGrid.tsx`): 2×2 grid showing Prép./Cuisson/Coût/Difficulté with values or shimmer or "—" for null.

5. **ShimmerBlock component** (`src/components/recipes/ShimmerBlock.tsx`): variants `rect`, `pill`, `image`. 1.5s sweep cycle. CSS vars `--shimmer-base` (#E5DED6) and `--shimmer-highlight` (#F0EDE8). `aria-busy="true"` on container, `aria-live="polite"` for completion.

6. **TagChip component** (`src/components/recipes/TagChip.tsx`): olive tint bg (`--tag-chip-bg`: #6E7A38/12%), `text-xs font-medium`, read-only on detail (no × button).

7. **SeasonBadge component** (`src/components/recipes/SeasonBadge.tsx`): season label display with optional accent colors.

8. **View tracking**: on page load, `last_viewed_at` updated to current timestamp and `view_count` incremented by 1.

9. **Design tokens** in `globals.css`: `--shimmer-base`, `--shimmer-highlight`, `--tag-chip-bg`, `--tag-chip-text`, `--season-spring`, `--season-summer`, `--season-autumn`, `--season-winter`, `--reveal-duration`.

## Tasks / Subtasks

- [x] Task 1: Add v3 design tokens to `src/app/globals.css` (AC: #9)
  - [x] Add shimmer CSS variables
  - [x] Add tag chip CSS variables
  - [x] Add season accent color CSS variables
  - [x] Add `--reveal-duration: 300ms`
  - [x] Add shimmer keyframe animation
- [x] Task 2: Create `ShimmerBlock` component (AC: #5)
  - [x] New file: `src/components/recipes/ShimmerBlock.tsx` (client component)
  - [x] `variant` prop: `rect` | `pill` | `image`
  - [x] CSS animation: 1.5s sweep using gradient
  - [x] `aria-busy="true"` on container
- [x] Task 3: Create `MetadataGrid` component (AC: #4)
  - [x] New file: `src/components/recipes/MetadataGrid.tsx` (client component for shimmer state)
  - [x] 2×2 CSS grid layout
  - [x] Shows labels always, values or ShimmerBlock depending on enrichment status
  - [x] Shows "—" for null values when enrichment is complete/failed
  - [x] Fade-in transition on values (300ms)
- [x] Task 4: Create `TagChip` component (AC: #6)
  - [x] New file: `src/components/recipes/TagChip.tsx`
  - [x] Olive tint bg, text-xs font-medium
  - [x] `editable` prop: when false (detail view), no × button; when true (edit form), shows × with aria-label
- [x] Task 5: Create `SeasonBadge` component (AC: #7)
  - [x] New file: `src/components/recipes/SeasonBadge.tsx`
  - [x] Season label with optional accent color per season
- [x] Task 6: Update recipe detail page `src/app/(app)/recipes/[id]/page.tsx` (AC: #1, #2, #3, #8)
  - [x] Fetch recipe with v3 fields (join already handled by Story 1.3)
  - [x] Add MetadataGrid section below title
  - [x] Replace current tag display with TagChip components
  - [x] Add SeasonBadge components
  - [x] Move tags + seasons to bottom after divider
  - [x] Conditional shimmer vs real content based on enrichmentStatus
  - [x] Hero image: show generated image, user photo, or placeholder gradient
  - [x] Add `aria-live="polite"` region for enrichment completion
  - [x] Add view tracking (server-side DB update on page load)
- [x] Task 7: Create client wrapper for enrichment polling on detail page
  - [x] Client component that wraps the enrichment-dependent sections
  - [x] Uses `useEnrichmentPolling` hook from Story 1.3
  - [x] Passes initial status from server component

## Dev Notes

### Current detail page structure

The existing `src/app/(app)/recipes/[id]/page.tsx` is a **server component** with:
- Photo hero (4:3 aspect ratio) with frosted glass back/edit/delete buttons
- Title (h1, font-serif, 22px)
- Tags (rounded-full olive chips — currently renders `recipe.tags` as `string[]`)
- Ingredients section (divider → heading → unordered list)
- Steps section (divider → heading → numbered list with olive circles)

### V3 page layout (matching mockup Screen 3)

```
┌──────────────────────────────┐
│  4:3 Hero Image              │  ← generated image / user photo / placeholder
│  [←]                  [✎][🗑] │  ← frosted glass buttons (existing)
└──────────────────────────────┘
  Title (font-serif, 22px)        ← existing

  ┌──────────┬──────────────┐     ← NEW: MetadataGrid
  │ Prép.    │ Cuisson      │
  │ 10-20min │ 15-30min     │
  ├──────────┼──────────────┤
  │ Coût     │ Difficulté   │
  │ €        │ Facile       │
  └──────────┴──────────────┘

  ─────── divider ───────         ← existing
  INGRÉDIENTS heading             ← existing
  • ingredient list               ← existing

  ─────── divider ───────         ← existing
  PRÉPARATION heading             ← existing
  1. step list                    ← existing

  ─────── divider ───────         ← NEW: bottom divider
  [TagChip] [TagChip] [SeasonBadge] [SeasonBadge]  ← tags + seasons flow together
```

### Shimmer animation CSS

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.shimmer {
  background: linear-gradient(
    90deg,
    var(--shimmer-base) 25%,
    var(--shimmer-highlight) 50%,
    var(--shimmer-base) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

### Server component + client component split

The detail page is a **server component** (fetches recipe data). Shimmer/polling requires client-side state. Solution:
- Server component fetches recipe with all v3 data
- Pass `enrichmentStatus` and `imageStatus` as props to a client component wrapper
- Client wrapper uses `useEnrichmentPolling` hook
- When polling detects status change, `router.refresh()` re-renders the server component with fresh data

### View tracking implementation

Add to the server component's recipe fetch:

```typescript
// Fire-and-forget view tracking (don't block render)
const supabase = createServerClient()
supabase
  .from('recipes')
  .update({
    last_viewed_at: new Date().toISOString(),
    view_count: (recipe.viewCount ?? 0) + 1
  })
  .eq('id', id)
  .then() // fire-and-forget
```

**Note:** Use `after()` from `next/server` if available in the page context, otherwise fire-and-forget with `.then()`. Do NOT `await` — it should not block page render.

### Image display priority

1. User-uploaded photo (`photoUrl`) — always preferred
2. AI-generated image (`generatedImageUrl`) — fallback
3. Placeholder gradient (`getRecipePlaceholderGradient(id)`) — last resort

### Dependencies

- **Story 1.1** (types, i18n strings, design tokens)
- **Story 1.2** (enrichment pipeline — needed for status values)
- **Story 1.3** (API routes return v3 data, polling hook)

### Existing components to NOT break

- `WakeLockActivator` — keep as-is
- `ConfirmDeleteDialog` — keep as-is
- Frosted glass buttons — keep existing styling
- Title font — keep existing `font-serif text-[22px]`

### Project Structure Notes

- New files: `ShimmerBlock.tsx`, `MetadataGrid.tsx`, `TagChip.tsx`, `SeasonBadge.tsx` (all in `src/components/recipes/`)
- Modified files: `src/app/(app)/recipes/[id]/page.tsx`, `src/app/globals.css`
- All new components are client components (`'use client'`) for animation/interaction support

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Screen 3: Détail (enrichi)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components > ShimmerBlock]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components > TagChip]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Experience Mechanics]
- [Source: _bmad-output/planning-artifacts/v3-screen-mockups.html — Screen 3, Screen 4]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: src/app/(app)/recipes/[id]/page.tsx — current detail page]
- [Source: src/app/globals.css — existing CSS variables]
- [Source: src/lib/recipe-placeholder.ts — placeholder gradient utility]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- Added v3 design tokens to globals.css: shimmer vars, tag chip vars, season accent colors, reveal duration, shimmer keyframe animation.
- Created ShimmerBlock component with rect/pill/image variants and aria-busy attribute.
- Created MetadataGrid component: 2×2 CSS grid with labels always visible, shimmer blocks during loading, "—" for null values when complete.
- Created TagChip component: olive tint bg with editable prop for optional × remove button.
- Created SeasonBadge component: color-coded per season using color-mix for translucent backgrounds.
- Created EnrichmentPollingWrapper: thin client component that activates useEnrichmentPolling hook.
- Updated recipe detail page with full v3 layout: shimmer hero during image loading, MetadataGrid below title, TagChip + SeasonBadge in flowing bottom section, image priority (user photo > generated > placeholder), fire-and-forget view tracking.
- All 55 tests pass, TypeScript compiles clean, Next.js build succeeds.

### Change Log

- 2026-03-14: Story 1.4 implemented — v3 detail page with shimmer loading, metadata grid, tag chips, season badges, enrichment polling, view tracking

### File List

- src/app/globals.css (modified)
- src/components/recipes/ShimmerBlock.tsx (new)
- src/components/recipes/MetadataGrid.tsx (new)
- src/components/recipes/TagChip.tsx (new)
- src/components/recipes/SeasonBadge.tsx (new)
- src/components/recipes/EnrichmentPollingWrapper.tsx (new)
- src/app/(app)/recipes/[id]/page.tsx (modified)
