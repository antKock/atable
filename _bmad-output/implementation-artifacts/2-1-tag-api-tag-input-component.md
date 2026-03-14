# Story 2.1: Tag API & Tag Input Component

Status: done

## Story

As a user,
I want to add and remove tags on my recipe with an autocomplete grouped by category,
So that I can correct AI-assigned tags or add my own in just a few taps.

## Acceptance Criteria

1. **GET /api/tags** route returns all predefined tags (`household_id IS NULL`) plus custom tags for the current household, grouped by category. Response shape: `{ tags: Array<{ id, name, category }> }`.

2. **POST /api/tags** route creates a custom tag when called with `{ name }` and no matching predefined tag exists. Sets `is_predefined = false`, `household_id` to current household, `category = null`. Returns the created tag `{ id, name, category }`.

3. **TagInput component** (`src/components/recipes/TagInput.tsx`) — client component with `role="combobox"`, `aria-expanded`, `aria-activedescendant` for keyboard navigation. Typing filters the preloaded tag list client-side (< 100ms). Suggestions grouped by category headers (Type de plat, Régime, Protéine, Cuisine, Occasion, Caractéristiques).

4. **Custom tag creation** — when no matching predefined tag exists, a "Créer '{input}'" option appears at the bottom of the dropdown. Selecting it calls `POST /api/tags`, then adds the new tag to the recipe.

5. **TagChip in editable mode** — in the edit form, each `TagChip` shows a × button with `aria-label="Retirer le tag {name}"`. Tapping × removes the tag from the recipe's tag list (1 tap to remove).

6. **Tag persistence on save** — when the recipe is saved with updated tags, tags are persisted using delete-then-insert (replace all) pattern on `recipe_tags` table (Architecture: conflict point 5).

7. **RecipeForm integration** — the existing comma-separated tags `<Input>` is replaced with the `TagInput` + `TagChip` components. Selected tags appear as `TagChip` chips above/below the input. The form sends tag IDs (not names) in the save payload.

## Tasks / Subtasks

- [x] Task 1: Create `GET /api/tags` route handler (AC: #1)
  - [x] New file: `src/app/api/tags/route.ts`
  - [x] Query `tags` table: all rows where `household_id IS NULL` OR `household_id = currentHouseholdId`
  - [x] Return `{ tags: [...] }` sorted by category then name
  - [x] Use `createServerClient()` with household ID from `x-household-id` header
- [x] Task 2: Create `POST /api/tags` route handler (AC: #2)
  - [x] Add POST handler in same `src/app/api/tags/route.ts`
  - [x] Validate request body with Zod: `{ name: z.string().min(1).max(50) }`
  - [x] Check if tag with same name already exists (predefined or household-scoped) — return existing if found
  - [x] Insert with `is_predefined = false`, `household_id` from session, `category = null`
  - [x] Return created tag `{ id, name, category }`
- [x] Task 3: Update `TagChip` component for editable mode (AC: #5)
  - [x] Modify `src/components/recipes/TagChip.tsx` (created in Story 1.4)
  - [x] Add `onRemove?: () => void` prop — when present, render × button
  - [x] × button: `aria-label="Retirer le tag {name}"`, 44×44px touch target
  - [x] Verify read-only mode (no `onRemove`) still works on detail page
- [x] Task 4: Create `TagInput` component (AC: #3, #4)
  - [x] New file: `src/components/recipes/TagInput.tsx` (client component)
  - [x] Props: `selectedTags: Tag[]`, `onAdd: (tag: Tag) => void`, `onRemove: (tagId: string) => void`
  - [x] Fetch all tags from `GET /api/tags` on mount (cache in component state)
  - [x] Filter suggestions client-side as user types (case-insensitive, accent-insensitive)
  - [x] Group suggestions by category with category headers in dropdown
  - [x] Hide already-selected tags from suggestions
  - [x] "Créer '{input}'" option when no match — calls `POST /api/tags` on select
  - [x] Keyboard navigation: arrow keys through suggestions, Enter to select, Escape to close
  - [x] ARIA: `role="combobox"`, `aria-expanded`, `aria-activedescendant`, `aria-controls`
  - [x] Dropdown: `role="listbox"`, category headers as `role="group"` with `aria-label`
- [x] Task 5: Update edit page query to use tag join (AC: #7)
  - [x] In `src/app/(app)/recipes/[id]/edit/page.tsx`, change `.select("*")` to `.select('*, recipe_tags(tag_id, tags(id, name, category))')` (Architecture: conflict point 4)
  - [x] Verify `mapDbRowToRecipe` correctly flattens the joined tags (from Story 1.1)
- [x] Task 6: Integrate into `RecipeForm.tsx` (AC: #6, #7)
  - [x] Replace the comma-separated `<Input id="tags">` section with `TagInput` + `TagChip` list
  - [x] Maintain `selectedTags: Tag[]` in form state (initialized from `initialData.tags` in edit mode)
  - [x] Render selected tags as `TagChip` chips with `onRemove` above the `TagInput`
  - [x] On save, send tag IDs in the request body: `tags: selectedTags.map(t => t.id)`
  - [x] Remove `tagsToString()` and `stringToTags()` helper functions (no longer needed)
- [x] Task 7: Update PUT `/api/recipes/[id]` to handle tag IDs (AC: #6)
  - [x] Accept `tags` as `string[]` of tag UUIDs (not tag names)
  - [x] On save: delete all `recipe_tags` for this recipe, then insert new tag IDs
  - [x] Update `RecipeUpdateSchema` if not already handling tag IDs
  - [x] Ensure `revalidatePath('/library')` is called (library depends on tags for filtering)
- [x] Task 8: Update POST `/api/recipes` to handle tag IDs
  - [x] Accept `tags` as `string[]` of tag UUIDs
  - [x] After recipe creation: insert into `recipe_tags` junction table
  - [x] Update `RecipeCreateSchema` if not already handling tag IDs

## Dev Notes

### Current tag implementation (v2)

The existing `RecipeForm.tsx` uses a plain `<Input>` with comma-separated text, converted via `stringToTags()` / `tagsToString()`. Tags are stored directly as `TEXT[]` on the `recipes` table. In v3, tags move to the relational `tags` + `recipe_tags` model (Story 1.1).

### Tag type reference

After Story 1.1, the `Tag` type is:
```typescript
type Tag = { id: string; name: string; category: string | null }
```

The `Recipe.tags` field changes from `string[]` to `Tag[]`.

### Category display order

The dropdown should group tags in this order:
1. Type de plat
2. Régime alimentaire
3. Protéine principale
4. Cuisine
5. Occasion
6. Caractéristiques

Custom tags (`category = null`) appear in a separate "Autres" group at the bottom.

### Accent-insensitive filtering

French tags contain accents (Végétarien, Méditerranéenne). The filter should normalize accents for matching:
```typescript
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
```

### Delete-then-insert pattern (Architecture conflict point 5)

```typescript
// ✅ Replace all tags atomically
await supabase.from('recipe_tags').delete().eq('recipe_id', id)
await supabase.from('recipe_tags').insert(
  newTagIds.map(tagId => ({ recipe_id: id, tag_id: tagId }))
)

// ❌ Never diff and selectively insert/delete
```

### Existing `TagChip` from Story 1.4

Story 1.4 creates `TagChip.tsx` as a read-only component. This story adds the `onRemove` prop for editable mode. Check the existing component before modifying — do not recreate from scratch.

### Tag loading strategy

Fetch all tags once on component mount via `GET /api/tags`. The full tag list is ~50-60 tags — small enough to preload entirely. Filter client-side for < 100ms responsiveness. Do NOT fetch on every keystroke.

### Form state change

The form currently tracks `tagsInput: string` (comma-separated text). Replace with `selectedTags: Tag[]` (array of tag objects). Initialize from `initialData.tags` (which is now `Tag[]` after Story 1.1).

### UX spec compliance

- Dropdown: category-grouped suggestions, filtered by typed text
- Chip removal: 1 tap on × button
- Custom tag creation: "Créer '{input}'" option at bottom of dropdown
- No divider between tags section and metadata fields below (Story 2.2)
- Match `v3-screen-mockups.html` Screen 5 tags section

### i18n strings needed

Strings should already exist in `fr.ts` after Story 1.1. If missing, add:
- `form.tagsPlaceholder`: "Ajouter un tag…"
- `form.createTag`: "Créer '{name}'"
- `tagCategories.*`: Category headers for dropdown

### Implementation order within Epic 2

Stories should be implemented in order: **2.1 → 2.2 → 2.3**. This matches the form field order (Tags → Metadata → Photo) and minimizes merge conflicts since all three stories modify `RecipeForm.tsx`.

### Create mode behavior

In create mode, `TagInput` works identically — the user can add tags before saving. `initialData.tags` is `undefined`/empty, so `selectedTags` starts as `[]`. After save, enrichment fills tags if the user didn't select any (AI only assigns tags when `recipe_tags` count is 0).

### Project Structure Notes

- New files: `src/app/api/tags/route.ts`, `src/components/recipes/TagInput.tsx`
- Modified files: `src/components/recipes/TagChip.tsx`, `src/components/recipes/RecipeForm.tsx`, `src/app/api/recipes/route.ts`, `src/app/api/recipes/[id]/route.ts`
- Alignment with architecture: `api/tags/` route follows existing `api/recipes/` pattern

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Tag-Specific Patterns — conflict points 4, 5]
- [Source: _bmad-output/planning-artifacts/architecture.md#New Route Handlers — GET/POST /api/tags]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components > TagInput]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components > TagChip]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Screen 5: Édition]
- [Source: _bmad-output/planning-artifacts/v3-screen-mockups.html — Screen 5, tags section]
- [Source: src/components/recipes/RecipeForm.tsx — current form with comma-separated tags]
- [Source: src/app/api/recipes/[id]/route.ts — current PUT handler]
- [Source: _bmad-output/implementation-artifacts/1-1-v3-data-model-tag-taxonomy.md — Tag type, tag taxonomy]
- [Source: _bmad-output/implementation-artifacts/1-4-recipe-detail-page-v3.md — TagChip component]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- Created GET/POST `/api/tags` route with household-scoped tag retrieval and custom tag creation
- Updated `TagChip` with 44×44px touch target for remove button, aria-label "Retirer le tag {name}"
- Created `TagInput` combobox component with category-grouped dropdown, accent-insensitive filtering, keyboard nav, custom tag creation ("Créer '{input}'")
- Replaced comma-separated tags `<Input>` with `TagInput` + `TagChip` in `RecipeForm`
- Form now sends `tagIds` (UUIDs) instead of comma-separated tag names
- Updated PUT `/api/recipes/[id]` and POST `/api/recipes` to handle `tagIds` with delete-then-insert pattern
- Added `revalidatePath('/library')` to PUT handler
- All 89 tests pass, TypeScript compiles cleanly

### File List

- src/app/api/tags/route.ts (new)
- src/components/recipes/TagInput.tsx (new)
- src/components/recipes/TagChip.tsx (modified)
- src/components/recipes/TagChip.test.tsx (modified)
- src/components/recipes/RecipeForm.tsx (modified)
- src/components/recipes/RecipeForm.test.tsx (modified)
- src/app/api/recipes/route.ts (modified)
- src/app/api/recipes/[id]/route.ts (modified)

### Change Log

- 2026-03-14: Story 2.1 implemented — Tag API routes, TagInput combobox, TagChip editable mode, RecipeForm integration
- 2026-03-14: Code review fixes — TagInput now reuses TagChip component instead of duplicating markup; removed legacy `tags` TEXT[] column writes from PUT/POST handlers; removed stale `tagsHelper` i18n string
