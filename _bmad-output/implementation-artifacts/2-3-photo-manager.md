# Story 2.3: Photo Manager — Regenerate, Replace & Remove

Status: done

## Story

As a user,
I want to regenerate the AI illustration, replace it with my own photo, or remove it entirely from the edit form,
So that every recipe has the image that best represents the dish.

## Acceptance Criteria

1. **PhotoManager component** (`src/components/recipes/PhotoManager.tsx`) — when a recipe has a photo (user-uploaded or AI-generated), displays a 4:3 image preview with 3 frosted-glass action buttons: Régénérer (refresh icon), Remplacer, Supprimer. Buttons use frosted glass styling: `rgba(255,255,255,0.85)`, `backdrop-filter: blur(6px)`, 12px font.

2. **Régénérer action** — sets a `regenerateImage` flag on the form. On save, the PUT handler calls `regenerateImage(id)` via `waitUntil()`. A new DALL-E 3 image is generated using current recipe content, downloaded, and uploaded to OVH. The old generated image URL is replaced.

3. **Remplacer action** — opens the device file picker. The user selects a photo which replaces the current image. Uses the same upload flow as existing v2 photo upload (`usePhotoUpload` hook). Preview updates immediately to show the selected photo.

4. **Supprimer action** — removes the photo from the recipe (both `photo_url` and `generated_image_url` cleared). PhotoManager switches to the "no photo" state showing an upload prompt. **Note:** the removal is local to form state until the user saves — this acts as implicit confirmation (the user must tap "Enregistrer" to persist the deletion). No separate confirmation dialog needed.

5. **No photo state** — shows an upload prompt (placeholder) allowing the user to add a photo from their device.

6. **Accessibility** — each button has a descriptive accessible label. File input is keyboard-accessible.

## Tasks / Subtasks

- [x] Task 1: Create `PhotoManager` component (AC: #1, #5, #6)
  - [x] New file: `src/components/recipes/PhotoManager.tsx` (client component)
  - [x] Props: `currentPhotoUrl: string | null`, `currentGeneratedUrl: string | null`, `previewFile: File | null`, `onRegenerate: () => void`, `onReplace: (file: File) => void`, `onRemove: () => void`
  - [x] Has-photo state: 4:3 image preview + 3 frosted-glass buttons below
  - [x] No-photo state: dashed border upload prompt (reuse existing PhotoPicker pattern)
  - [x] Hidden file input with `accept="image/*"`, triggered by Remplacer button and no-photo prompt
  - [x] Image display priority: previewFile blob URL > currentPhotoUrl > currentGeneratedUrl > placeholder
  - [x] Frosted glass button styling: `bg-white/85 backdrop-blur-sm text-xs font-medium`
  - [x] Each button: `type="button"`, descriptive `aria-label`
  - [x] Régénérer button includes refresh icon (Lucide `RefreshCw`)
- [x] Task 2: Replace `PhotoPicker` with `PhotoManager` in `RecipeForm.tsx` (AC: #1, #3, #4)
  - [x] Replace `<PhotoPicker>` with `<PhotoManager>` in the form
  - [x] Add `regenerateRequested: boolean` state to form
  - [x] Wire `onRegenerate`: sets `regenerateRequested = true` (visual feedback: button shows "Régénération au prochain enregistrement" or similar indicator)
  - [x] Wire `onReplace`: sets `photoFile` (same as current), clears `regenerateRequested`
  - [x] Wire `onRemove`: sets `photoRemoved = true`, clears `photoFile` and `regenerateRequested`
  - [x] Pass `currentGeneratedUrl` from `initialData.generatedImageUrl` (new v3 field)
- [x] Task 3: Update form submission for regenerate flag (AC: #2)
  - [x] When `regenerateRequested` is true, include `regenerateImage: true` in PUT body
  - [x] On submit success with regenerate: image will be generated async (shimmer on detail page)
- [x] Task 4: Update PUT `/api/recipes/[id]` to handle `regenerateImage` flag (AC: #2)
  - [x] Accept optional `regenerateImage: boolean` in request body
  - [x] When `regenerateImage` is true: set `image_status = 'pending'`, call `waitUntil(regenerateImage(id))` using the function from `lib/enrichment.ts`
  - [x] `regenerateImage(id)` in `lib/enrichment.ts` (Architecture gap 1): runs DALL-E 3 → download → OVH upload → persist `generated_image_url` + `image_status = 'generated'`
- [x] Task 5: Update PUT handler for photo removal (AC: #4)
  - [x] When `photoUrl` is explicitly `null` in request body: clear both `photo_url` AND `generated_image_url` in DB
  - [x] Set `image_status = 'none'` when both photo fields are cleared
- [x] Task 6: Update `EditProps` to include `generatedImageUrl` (AC: #1)
  - [x] Extend `initialData` to pass `generatedImageUrl` from recipe
  - [x] Update edit page to pass this new field
- [x] Task 7: Verify `regenerateImage()` exists in `lib/enrichment.ts`
  - [x] Confirm Story 1.2 creates this function (Architecture gap 1 resolution)
  - [x] If not, create: reads recipe → generates DALL-E 3 image using `image_prompt` → downloads → uploads to OVH → updates `generated_image_url` and `image_status`
  - [x] This function does NOT re-run metadata enrichment — image only

## Dev Notes

### Existing PhotoPicker vs new PhotoManager

The current `PhotoPicker.tsx` handles:
- Hidden file input
- Blob URL preview creation/cleanup
- "Replace" and "Remove" buttons (plain outline style)
- No-photo placeholder with camera icon

`PhotoManager` replaces it with:
- Same file input and blob URL logic (reuse or adapt from PhotoPicker)
- Frosted-glass button styling instead of outline buttons
- New "Régénérer" button (triggers AI image regeneration)
- Awareness of `generatedImageUrl` (v3) in addition to `photoUrl` (v2)
- Same no-photo placeholder pattern

Do NOT delete `PhotoPicker.tsx` — it may still be used in the create form if desired. Or replace it everywhere with `PhotoManager`.

### Image display priority

```
1. previewFile (blob URL from newly selected file) — always top priority
2. currentPhotoUrl (user-uploaded photo from DB)
3. currentGeneratedUrl (AI-generated image from DB)
4. Placeholder (dashed border + camera icon)
```

This matches the detail page priority: user photo > generated image > placeholder.

### Frosted glass button styling

From UX spec "Button Hierarchy > Photo action":
```
bg: rgba(255, 255, 255, 0.85)
backdrop-filter: blur(6px)
font-size: 12px
```

Tailwind:
```
className="bg-white/85 backdrop-blur-sm text-xs font-medium rounded-lg px-3 py-2 min-h-[44px]"
```

### Responsive behavior (UX spec)

- **Mobile (<1024px):** CTAs below photo (stacked or row)
- **Desktop (≥1024px):** CTAs overlaid on photo hover

For MVP, stacking below the photo (mobile-first) is the simplest approach. Desktop hover overlay can be a future enhancement.

### `regenerateImage()` function (Architecture gap 1)

Per architecture doc, `lib/enrichment.ts` exports two functions:
- `enrichRecipe(id)` — full pipeline (metadata + image)
- `regenerateImage(id)` — image-only pipeline (DALL-E 3 → download → OVH → persist)

The Régénérer button triggers `regenerateImage(id)`, NOT `enrichRecipe(id)`. This ensures metadata is not re-enriched when the user only wants a new image.

### Photo removal behavior

When user taps "Supprimer":
- Form state: `photoRemoved = true`, `photoFile = null`, `regenerateRequested = false`
- On save: PUT body includes `photoUrl: null`
- API handler: clears both `photo_url` and `generated_image_url` in DB
- This ensures both user photos and AI images are removed

### Create mode behavior

In create mode, the user can only add a photo (no Régénérer since there's no AI image yet). The PhotoManager should adapt:
- No Régénérer button if `currentGeneratedUrl` is null AND this is a new recipe
- Show "Remplacer" as "Ajouter" or just show the upload prompt

However, the simplest approach: always show PhotoManager with the same interface — Régénérer only appears when `currentGeneratedUrl` exists.

### Action precedence rules

The form state must enforce these precedence rules:
- **Replace clears regenerate**: `onReplace` → sets `photoFile`, clears `regenerateRequested`
- **Regenerate clears replace**: `onRegenerate` → sets `regenerateRequested`, clears `photoFile`
- **Remove clears everything**: `onRemove` → sets `photoRemoved`, clears `photoFile` AND `regenerateRequested`

Only one photo action can be active at save time. The last action wins.

### Image status on user photo upload

When the user uploads their own photo (Remplacer), `photo_url` is set and takes display priority. The `generated_image_url` and `image_status` values are left as-is in the DB — they don't need clearing because `photo_url` always takes priority in the display logic. If the user later removes their photo, the generated image (if any) resurfaces.

### Implementation order within Epic 2

Stories should be implemented in order: **2.1 → 2.2 → 2.3**. This matches the form field order and minimizes merge conflicts.

### usePhotoUpload reuse

The existing `usePhotoUpload` hook handles: file → Supabase Storage → PATCH `/api/recipes/{id}/photo`. This is used for the "Remplacer" action — same fire-and-forget pattern as current form.

### Dependencies

- **Story 1.1** — `generatedImageUrl` field on Recipe type
- **Story 1.2** — `regenerateImage()` function in `lib/enrichment.ts`, `waitUntil()` pattern in route handlers
- **Story 2.1** — TagInput (should be done first — Photo section comes before Tags in field order, but both modify RecipeForm)

### Project Structure Notes

- New file: `src/components/recipes/PhotoManager.tsx`
- Modified files: `src/components/recipes/RecipeForm.tsx`, `src/app/api/recipes/[id]/route.ts`, `src/app/(app)/recipes/[id]/edit/page.tsx`
- `PhotoPicker.tsx` may be kept (for potential reuse) or deprecated — dev's choice

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components > PhotoManager]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Screen 5: Édition — photo section]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Button Hierarchy > Photo action]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Responsive Design — PhotoManager row]
- [Source: _bmad-output/planning-artifacts/architecture.md#Gap 1 — regenerateImage() function]
- [Source: _bmad-output/planning-artifacts/architecture.md#Conflict Point 7 — Image pipeline flow]
- [Source: _bmad-output/planning-artifacts/architecture.md#Conflict Point 8 — Enrichment status transitions]
- [Source: src/components/recipes/PhotoPicker.tsx — current photo picker implementation]
- [Source: src/hooks/usePhotoUpload.ts — existing upload hook]
- [Source: src/components/recipes/RecipeForm.tsx — current form with PhotoPicker]
- [Source: _bmad-output/implementation-artifacts/1-2-openai-client-enrichment-pipeline.md — enrichment pipeline]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- Created `PhotoManager` component replacing `PhotoPicker` with Régénérer/Remplacer/Supprimer buttons
- Frosted glass button styling per UX spec: `bg-white/85 backdrop-blur-sm`
- Régénérer button shows active state when regeneration requested
- Image display priority: previewFile > photoUrl > generatedUrl > placeholder
- Action precedence: Replace clears regenerate, Remove clears everything
- Added `regenerateImage` flag to `RecipeUpdateSchema` and PUT handler
- PUT handler: when `photoUrl=null`, clears both `photo_url` and `generated_image_url`, sets `image_status='none'`
- PUT handler: when `regenerateImage=true`, sets `image_status='pending'` and calls `regenerateImage()` via `after()`
- Updated `EditProps` to include `generatedImageUrl`, edit page passes it
- `regenerateImage()` function already exists in `lib/enrichment.ts` from Story 1.2
- All 89 tests pass, TypeScript compiles cleanly

### File List

- src/components/recipes/PhotoManager.tsx (new)
- src/components/recipes/RecipeForm.tsx (modified)
- src/components/recipes/RecipeForm.test.tsx (modified)
- src/app/api/recipes/[id]/route.ts (modified)
- src/app/(app)/recipes/[id]/edit/page.tsx (modified)
- src/lib/schemas/recipe.ts (modified)

### Change Log

- 2026-03-14: Story 2.3 implemented — PhotoManager component with regenerate/replace/remove, PUT handler updates
- 2026-03-14: Code review fixes — fixed file input a11y (replaced `aria-hidden` with `tabIndex={-1}`); moved all hardcoded French strings to `t.photoManager.*` in i18n
