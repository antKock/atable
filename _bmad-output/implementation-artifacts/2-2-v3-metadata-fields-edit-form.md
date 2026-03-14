# Story 2.2: V3 Metadata Fields in Edit Form

Status: done

## Story

As a user,
I want to manually adjust prep time, cook time, cost, complexity, and seasons in the edit form,
So that I can correct any AI-inferred values that don't match my recipe.

## Acceptance Criteria

1. **Edit form field order** — fields appear in this exact order: Titre → Photo → Ingrédients → Préparation → Tags → Prép./Cuisson → Coût → Difficulté → Saisons. No divider between Tags and metadata fields — they flow as one continuous form. No navbar (fullscreen mode) with sticky submit button at the true bottom.

2. **Prép. and Cuisson fields** — side-by-side select dropdowns (`grid-template-columns: 1fr 1fr`, 12px gap). Prép. options: `< 10 min`, `10-20 min`, `20-30 min`, `30-45 min`, `> 45 min`. Cuisson options: `Aucune`, `< 15 min`, `15-30 min`, `30 min - 1h`, `1h - 2h`, `> 2h`.

3. **Coût field** — `ChipSelector` component with three options: €, €€, €€€ (single-select). Selected chip: olive accent bg (`--accent`), white text. Unselected: transparent bg, border, muted text. Each chip has `aria-pressed` state.

4. **Difficulté field** — select dropdown with options: Facile, Moyen, Difficile.

5. **Saisons field** — multi-select `ChipSelector` with four options: Printemps, Été, Automne, Hiver. Multiple seasons can be selected simultaneously. Chip on/off states match Coût chip styling.

6. **ChipSelector component** (`src/components/recipes/ChipSelector.tsx`) — reusable for both Coût (single-select) and Saisons (multi-select). Uses `role="group"` on container and `aria-pressed` on each chip. Keyboard Enter/Space toggles chip state.

7. **Pre-fill on edit** — all v3 metadata fields are pre-filled with current values (AI-set or previously user-corrected) when the edit form opens.

8. **Persistence on save** — user-set values are persisted via PUT. Subsequent enrichment respects "fill empty only" — these user-set values are never overwritten by AI.

## Tasks / Subtasks

- [x] Task 1: Create `ChipSelector` component (AC: #3, #5, #6)
  - [x] New file: `src/components/recipes/ChipSelector.tsx` (client component)
  - [x] Props: `options: string[]`, `selected: string | string[]`, `onChange: (value: string | string[]) => void`, `mode: 'single' | 'multi'`, `label: string`
  - [x] Container: `role="group"`, `aria-label={label}`
  - [x] Each chip: `button` with `aria-pressed`, `type="button"`
  - [x] Selected: `bg-accent text-white`, Unselected: `bg-transparent border border-border text-muted-foreground`
  - [x] Keyboard: Enter/Space toggles chip state
  - [x] Pill-shaped chips: `rounded-full`, min 44px touch target
- [x] Task 2: Add v3 metadata fields to `RecipeForm.tsx` (AC: #1, #2, #4, #7)
  - [x] Add form state for: `prepTime`, `cookTime`, `cost`, `complexity`, `seasons`
  - [x] Initialize from `initialData` (v3 fields available after Story 1.1)
  - [x] Add Prép./Cuisson side-by-side selects after Tags section
  - [x] Add Coût `ChipSelector` (single-select, options: ['€', '€€', '€€€'])
  - [x] Add Difficulté select dropdown (options: Facile, Moyen, Difficile)
  - [x] Add Saisons `ChipSelector` (multi-select, options: [Printemps, Été, Automne, Hiver])
  - [x] No divider between Tags and metadata fields
- [x] Task 3: Update form submission to include v3 fields (AC: #8)
  - [x] Include `prepTime`, `cookTime`, `cost`, `complexity`, `seasons` in PUT body
  - [x] Include same fields in POST body (create mode)
  - [x] Send `null` for unselected optional fields (not empty string)
- [x] Task 4: Update `EditProps` interface and `initialData` (AC: #7)
  - [x] Extend `EditProps.initialData` to include v3 fields: `prepTime`, `cookTime`, `cost`, `complexity`, `seasons`
  - [x] Update `src/app/(app)/recipes/[id]/edit/page.tsx` to pass v3 fields to `RecipeForm`
  - [x] Update `src/app/(app-fullscreen)/recipes/new/page.tsx` if it passes initial data
- [x] Task 5: Verify PUT/POST route handlers accept v3 fields
  - [x] Confirm `RecipeUpdateSchema` accepts optional v3 metadata fields (from Story 1.1)
  - [x] Confirm `RecipeCreateSchema` accepts optional v3 metadata fields
  - [x] Confirm route handlers persist v3 fields to DB
  - [x] If not yet handled, add v3 fields to the update/insert DB calls

## Dev Notes

### Form state additions

Current `RecipeForm` state:
```typescript
const [title, setTitle] = useState(initialData?.title ?? "");
const [ingredients, setIngredients] = useState(initialData?.ingredients ?? "");
const [steps, setSteps] = useState(initialData?.steps ?? "");
// tags handled by Story 2.1 (TagInput)
const [photoFile, setPhotoFile] = useState<File | null>(null);
const [photoRemoved, setPhotoRemoved] = useState(false);
```

Add:
```typescript
const [prepTime, setPrepTime] = useState<string | null>(initialData?.prepTime ?? null);
const [cookTime, setCookTime] = useState<string | null>(initialData?.cookTime ?? null);
const [cost, setCost] = useState<string | null>(initialData?.cost ?? null);
const [complexity, setComplexity] = useState<string | null>(initialData?.complexity ?? null);
const [seasons, setSeasons] = useState<string[]>(initialData?.seasons ?? []);
```

### Select dropdown values (exact strings matching DB/enrichment values)

**Prep time options:**
- `< 10 min`
- `10-20 min`
- `20-30 min`
- `30-45 min`
- `> 45 min`

**Cook time options:**
- `Aucune`
- `< 15 min`
- `15-30 min`
- `30 min - 1h`
- `1h - 2h`
- `> 2h`

**Cost options:** `€`, `€€`, `€€€`

**Complexity options:** `facile`, `moyen`, `difficile` (stored lowercase in DB, displayed with first letter capitalized via i18n)

**Season options:** `printemps`, `ete`, `automne`, `hiver` (stored lowercase without accents in DB, displayed via i18n as Printemps, Été, Automne, Hiver)

### UX spec: Form Patterns

- Labels: uppercase, 11px, 700 weight, letter-spacing 0.9px, `--muted-foreground`
- Selects: same styling as inputs + custom chevron SVG, 10px 12px padding, 10px border-radius
- Side-by-side fields: `grid-template-columns: 1fr 1fr`, 12px gap
- Chip selectors: pill-shaped, on/off states with olive accent
- Submit: sticky at bottom with gradient fade, full-width primary button

### ChipSelector styling reference

```
Selected:   bg-accent text-white font-semibold
Unselected: bg-transparent border border-border text-muted-foreground
```

Per mockup Screen 5, chips use the same olive accent color as active filter pills.

### Edit page data flow

The edit page (`src/app/(app)/recipes/[id]/edit/page.tsx`) is a server component that fetches the recipe and passes data to `RecipeForm`. After Story 1.1, the recipe object includes v3 fields. The `initialData` prop needs to be extended to include these fields.

Current:
```typescript
initialData={{
  title: recipe.title,
  ingredients: recipe.ingredients,
  steps: recipe.steps,
  tags: recipe.tags,
  photoUrl: recipe.photoUrl,
}}
```

After this story:
```typescript
initialData={{
  title: recipe.title,
  ingredients: recipe.ingredients,
  steps: recipe.steps,
  tags: recipe.tags,
  photoUrl: recipe.photoUrl,
  prepTime: recipe.prepTime,
  cookTime: recipe.cookTime,
  cost: recipe.cost,
  complexity: recipe.complexity,
  seasons: recipe.seasons,
}}
```

### "Fill empty only" — no extra work needed here

The "fill empty only" enrichment logic lives in `lib/enrichment.ts` (Story 1.2). It checks field values before overwriting. If the user sets a value via this form, it's persisted to DB, and enrichment will skip it. No special flag or logic needed in the form.

### Create mode behavior

In create mode, all v3 metadata fields start as `null` / `[]`. The user can optionally set them before saving. After save, enrichment fills any remaining null fields via AI.

### Implementation order within Epic 2

Stories should be implemented in order: **2.1 → 2.2 → 2.3**. This matches the form field order and minimizes merge conflicts.

### Display values vs stored values

The `ChipSelector` must map between display and stored values:
- **Cost**: display = stored (both `€`, `€€`, `€€€`)
- **Complexity**: stored `facile`/`moyen`/`difficile` → displayed via i18n `t.complexity.facile` = "Facile" etc.
- **Seasons**: stored `printemps`/`ete`/`automne`/`hiver` → displayed via i18n `t.seasons.printemps` = "Printemps" etc.

The `ChipSelector` options should use stored values internally and display labels via i18n lookup.

### Dependencies

- **Story 1.1** — v3 types, schemas, mapper (must be complete for `initialData` to include v3 fields)
- **Story 2.1** — TagInput replaces the old tags input (should be done first or in parallel, but the tags section comes before metadata in field order)

### i18n strings

Expected in `fr.ts` after Story 1.1:
- `metadata.prepTime`: "Prép."
- `metadata.cookTime`: "Cuisson"
- `metadata.cost`: "Coût"
- `metadata.complexity`: "Difficulté"
- `metadata.seasons`: "Saisons"
- Season display names, cost labels, complexity labels

### Project Structure Notes

- New file: `src/components/recipes/ChipSelector.tsx`
- Modified files: `src/components/recipes/RecipeForm.tsx`, `src/app/(app)/recipes/[id]/edit/page.tsx`
- No changes to API routes if Story 1.1 already extended schemas — verify and add if missing

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Screen 5: Édition]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components > ChipSelector]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Form Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — prep_time, cook_time, cost, complexity, seasons columns]
- [Source: _bmad-output/planning-artifacts/v3-screen-mockups.html — Screen 5, metadata fields]
- [Source: src/components/recipes/RecipeForm.tsx — current form structure]
- [Source: src/app/(app)/recipes/[id]/edit/page.tsx — current edit page]
- [Source: _bmad-output/implementation-artifacts/1-1-v3-data-model-tag-taxonomy.md — v3 types and schemas]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- Created `ChipSelector` component (single/multi mode) with `aria-pressed`, `role="group"`, pill-shaped chips
- Added v3 metadata fields to `RecipeForm`: Prép./Cuisson side-by-side selects, Coût ChipSelector, Difficulté select, Saisons multi-select ChipSelector
- Fields placed after Tags section with no divider, matching UX spec field order
- Updated `EditProps` to include v3 fields, edit page passes all v3 data
- Form sends v3 metadata in PUT/POST bodies, `null` for unselected values
- Added i18n strings for `metadata.seasons` and stored-value keys for seasons/complexity
- Added 8 ChipSelector tests, 3 new RecipeForm edit mode tests for v3 fields
- All 89 tests pass, TypeScript compiles cleanly

### File List

- src/components/recipes/ChipSelector.tsx (new)
- src/components/recipes/ChipSelector.test.tsx (new)
- src/components/recipes/RecipeForm.tsx (modified)
- src/components/recipes/RecipeForm.test.tsx (modified)
- src/app/(app)/recipes/[id]/edit/page.tsx (modified)
- src/lib/i18n/fr.ts (modified)

### Change Log

- 2026-03-14: Story 2.2 implemented — ChipSelector component, v3 metadata fields in edit form
- 2026-03-14: Code review fixes — removed incorrect `role="switch"` from ChipSelector (keeping `aria-pressed` on buttons); complexity options now use i18n display labels instead of inline capitalization
