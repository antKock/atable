# Story 1.3: Async Enrichment Trigger & Status Polling

Status: review

## Story

As a user,
I want recipe enrichment to happen automatically after I save without slowing down the save,
So that my recipe is immediately visible and metadata appears moments later.

## Acceptance Criteria

1. **POST /api/recipes** (create): after DB insert, sets `enrichment_status = 'pending'` and `image_status = 'pending'`, calls `waitUntil(enrichRecipe(id, true))`, returns 201 immediately. Save latency < 500ms.

2. **PUT /api/recipes/[id]** (update): after DB update, sets `enrichment_status = 'pending'` (image_status unchanged — no auto image re-gen on edit), calls `waitUntil(enrichRecipe(id, false))`, returns 200 immediately.

3. **GET /api/recipes/[id]**: response includes all v3 metadata fields AND tags via Supabase join `.select('*, recipe_tags(tag_id, tags(id, name, category))')`.

4. **GET /api/recipes** (list): response includes v3 fields needed for cards: `generatedImageUrl`, `enrichmentStatus`, `imageStatus`, plus existing fields.

5. **New route `GET /api/recipes/[id]/status`**: returns `{ enrichmentStatus, imageStatus }` for polling.

6. **`useEnrichmentPolling` hook** (`src/hooks/useEnrichmentPolling.ts`): polls `/api/recipes/[id]/status` every 3s when `enrichmentStatus === 'pending'` or `imageStatus === 'pending'`. Stops when both are terminal. Triggers `router.refresh()` on status change. Max 60s safety cutoff.

## Tasks / Subtasks

- [x] Task 1: Modify `POST /api/recipes` route (AC: #1)
  - [x] Add `enrichment_status: 'pending'` and `image_status: 'pending'` to insert payload
  - [x] Import `after` from `next/server` (Next.js 16 built-in)
  - [x] Call `after(async () => enrichRecipe(data.id, true))` after insert
  - [x] Ensure 201 response returns before enrichment completes
- [x] Task 2: Modify `PUT /api/recipes/[id]` route (AC: #2)
  - [x] Add `enrichment_status: 'pending'` to update payload (NOT image_status)
  - [x] Call `after(async () => enrichRecipe(id, false))` after update
  - [x] Handle v3 metadata fields in update payload (tags via delete-then-insert)
- [x] Task 3: Modify `GET /api/recipes/[id]` route (AC: #3)
  - [x] Change `.select('*')` to `.select('*, recipe_tags(tag_id, tags(id, name, category))')`
  - [x] Mapper handles the joined data
- [x] Task 4: Modify `GET /api/recipes` list route (AC: #4)
  - [x] Add v3 fields to select: `generated_image_url`, `enrichment_status`, `image_status`
  - [x] Update `RecipeListItem` mapping
- [x] Task 5: Create `GET /api/recipes/[id]/status` route (AC: #5)
  - [x] New file: `src/app/api/recipes/[id]/status/route.ts`
  - [x] Auth check (household_id header)
  - [x] Select only `enrichment_status, image_status` for minimal query
  - [x] Return `{ enrichmentStatus, imageStatus }`
- [x] Task 6: Create `useEnrichmentPolling` hook (AC: #6)
  - [x] New file: `src/hooks/useEnrichmentPolling.ts`
  - [x] Accept `recipeId` and initial status values
  - [x] Poll every 3s via `setInterval` + `fetch`
  - [x] Stop on terminal states or after 60s
  - [x] Call `router.refresh()` on status change
  - [x] Clean up interval on unmount

## Dev Notes

### `waitUntil` in Next.js 16

```typescript
import { after } from 'next/server'  // Next.js 15+ uses `after()` instead of `waitUntil()`

// In route handler:
after(async () => {
  await enrichRecipe(recipeId, true)
})
```

**CRITICAL:** Next.js 16 uses `after()` from `next/server`, NOT `waitUntil()`. The `after()` API was introduced in Next.js 15 and is the stable API in 16. Verify the exact import — it may be `import { after } from 'next/server'` or `import { unstable_after as after } from 'next/server'` depending on the exact Next.js 16.1.6 version.

### Existing route handler patterns

Current `POST /api/recipes` (`src/app/api/recipes/route.ts`):
- Uses `createServerClient()` for DB operations
- Uses `headers()` to get `x-household-id`
- Uses `RecipeCreateSchema.safeParse(body)` for validation
- Calls `revalidatePath('/home')` and `revalidatePath('/recipes/[id]')` after insert
- Returns `NextResponse.json(mapDbRowToRecipe(data), { status: 201 })`

Current `PUT /api/recipes/[id]` (`src/app/api/recipes/[id]/route.ts`):
- Same auth pattern
- Uses `RecipeUpdateSchema.safeParse(body)`
- Manually constructs `updatePayload` with snake_case keys
- Currently stores tags as `tags: result.data.tags ?? []` (TEXT[] column)

### Tag mutation on save (v3)

When a recipe is saved with tags, the route handler must:
1. Save recipe scalar fields (including v3 metadata) via `.update()`
2. Delete all existing `recipe_tags` for this recipe
3. Insert new `recipe_tags` rows for each tag ID

This is the **delete-then-insert** pattern (Architecture: conflict point 5). Never diff.

```typescript
// In PUT handler, after recipe update:
if (result.data.tagIds) {
  await supabase.from('recipe_tags').delete().eq('recipe_id', id)
  if (result.data.tagIds.length > 0) {
    await supabase.from('recipe_tags').insert(
      result.data.tagIds.map(tagId => ({ recipe_id: id, tag_id: tagId }))
    )
  }
}
```

### Polling hook pattern

```typescript
'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export function useEnrichmentPolling(
  recipeId: string,
  initialEnrichmentStatus: string,
  initialImageStatus: string
) {
  const router = useRouter()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef(Date.now())

  const isTerminal = useCallback((enrichment: string, image: string) => {
    const enrichmentDone = ['enriched', 'failed', 'none'].includes(enrichment)
    const imageDone = ['generated', 'failed', 'none'].includes(image)
    return enrichmentDone && imageDone
  }, [])

  useEffect(() => {
    if (isTerminal(initialEnrichmentStatus, initialImageStatus)) return

    startTimeRef.current = Date.now()

    intervalRef.current = setInterval(async () => {
      if (Date.now() - startTimeRef.current > 60_000) {
        clearInterval(intervalRef.current!)
        return
      }
      const res = await fetch(`/api/recipes/${recipeId}/status`)
      if (!res.ok) return
      const { enrichmentStatus, imageStatus } = await res.json()
      if (enrichmentStatus !== initialEnrichmentStatus || imageStatus !== initialImageStatus) {
        router.refresh()
      }
      if (isTerminal(enrichmentStatus, imageStatus)) {
        clearInterval(intervalRef.current!)
      }
    }, 3000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [recipeId, initialEnrichmentStatus, initialImageStatus, isTerminal, router])
}
```

### Dependencies

- **Story 1.1** must be complete (v3 DB schema, types, mapper)
- **Story 1.2** must be complete (`enrichRecipe`, `regenerateImage` functions)

### Project Structure Notes

- Modified files: `src/app/api/recipes/route.ts`, `src/app/api/recipes/[id]/route.ts`
- New files: `src/app/api/recipes/[id]/status/route.ts`, `src/hooks/useEnrichmentPolling.ts`
- Follows existing route handler patterns (auth via `x-household-id` header, `createServerClient()`)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Enrichment-Specific Patterns > Conflict Point 8]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3]
- [Source: _bmad-output/planning-artifacts/prd.md#AI Enrichment (FR1-FR6)]
- [Source: _bmad-output/planning-artifacts/prd.md#Enrichment UX (FR35-FR37)]
- [Source: src/app/api/recipes/route.ts — existing POST handler]
- [Source: src/app/api/recipes/[id]/route.ts — existing GET/PUT/DELETE handlers]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- POST /api/recipes now inserts with `enrichment_status: 'pending'` and `image_status: 'pending'`, then fires `after()` to run enrichment pipeline asynchronously.
- PUT /api/recipes/[id] now sets `enrichment_status: 'pending'` on update, handles v3 metadata fields, implements delete-then-insert tag mutation via `tagIds`, and fires `after()` for enrichment (isCreate=false, no image re-gen).
- GET /api/recipes/[id] and detail/edit server components now use `.select('*, recipe_tags(tag_id, tags(id, name, category))')` for relational tag joins.
- GET /api/recipes list already included v3 card fields from Story 1.1.
- Created GET /api/recipes/[id]/status route returning minimal `{ enrichmentStatus, imageStatus }`.
- Created `useEnrichmentPolling` hook: polls every 3s, stops on terminal states or 60s timeout, calls `router.refresh()` on status change.
- Used Next.js 16 `after()` (not `waitUntil`) for background task execution.
- All 55 tests pass, TypeScript compiles clean.

### Change Log

- 2026-03-14: Story 1.3 implemented — async enrichment triggers, tag join queries, status polling endpoint + hook

### File List

- src/app/api/recipes/route.ts (modified)
- src/app/api/recipes/[id]/route.ts (modified)
- src/app/api/recipes/[id]/status/route.ts (new)
- src/hooks/useEnrichmentPolling.ts (new)
- src/app/(app)/recipes/[id]/page.tsx (modified — tag join)
- src/app/(app)/recipes/[id]/edit/page.tsx (modified — tag join)
