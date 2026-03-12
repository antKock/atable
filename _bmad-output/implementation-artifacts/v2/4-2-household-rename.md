# Story 4.2: Household Rename

Status: done

## Story

As a household member,
I want to rename my household directly from the household menu,
So that I can update the name at any time.

## Acceptance Criteria

1. **Given** the `/household` page **When** the user views the household name **Then** there is an edit affordance (pencil icon) adjacent to the name
2. **Given** the `InlineEditableField` component **When** the user taps the pencil icon **Then** the household name text switches to an input field with the current name pre-filled
3. **Given** the inline edit field **When** the user submits a new non-empty name **Then** `PUT /api/households/[id]` is called with the new name **And** on success, the displayed name updates immediately without a page reload **And** `revalidatePath('/household')` is called server-side
4. **Given** `PUT /api/households/[id]` **When** the name passes `HouseholdCreateSchema` validation **Then** the `households` table is updated and response includes the updated name
5. **Given** the inline edit field **When** user submits an empty string or presses cancel (Escape) **Then** the field reverts to the current name without making an API call

## Tasks / Subtasks

- [x] Create `InlineEditableField` component (AC: 1–2, 5)
  - [x] `src/components/household/InlineEditableField.tsx` — Client Component
  - [x] Props: `{ value: string; onSave: (newValue: string) => Promise<void>; readOnly?: boolean }`
  - [x] Display mode: show current value + pencil icon button (≥44×44px touch target on the button)
  - [x] Edit mode: text input pre-filled with current value + save (checkmark) + cancel (X) buttons
  - [x] On pencil click: switch to edit mode
  - [x] On save: call `onSave(newValue)` — validates non-empty before calling
  - [x] On cancel or Escape key: revert to display mode with original value
  - [x] On empty submit: show inline error "Le nom ne peut pas être vide" — do NOT call API
  - [x] Loading state during save (disable input + show spinner)
- [x] Implement `PUT /api/households/[id]` route handler (AC: 3–4)
  - [x] `src/app/api/households/[id]/route.ts` — export `PUT` function
  - [x] Read `householdId` from `x-household-id` header (NOT from params — security)
  - [x] Validate `[id]` param matches the authenticated household ID (prevent cross-household rename)
  - [x] Validate body `{ name }` with `HouseholdCreateSchema`
  - [x] `UPDATE households SET name = $1 WHERE id = $2`
  - [x] Call `revalidatePath('/household')`
  - [x] Return `{ id, name }` on success
- [x] Integrate InlineEditableField into HouseholdMenuContent (AC: 1)
  - [x] In `HouseholdMenuContent.tsx`: render `InlineEditableField` for the household name
  - [x] `onSave`: calls `PUT /api/households/[id]` and updates local state optimistically

## Dev Notes

### Security — Verify Household Ownership

The `[id]` in the URL must match the authenticated user's `x-household-id`:

```ts
// PUT /api/households/[id]
const householdId = (await headers()).get('x-household-id')!
const { id } = await params
if (id !== householdId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

This prevents a member from renaming another household by guessing a UUID.

### InlineEditableField State Machine

```
[display mode]  ← initial
    ↓ pencil click
[edit mode]
    ↓ save (non-empty)          → API call → update display name → [display mode]
    ↓ save (empty)              → show validation error → stay in [edit mode]
    ↓ cancel / Escape key       → [display mode] with original name
    ↓ API error                 → show error message → stay in [edit mode]
```

### Optimistic Update Strategy

Update the displayed name immediately (optimistic), then revert on API error:

```ts
// In HouseholdMenuContent.tsx
const [name, setName] = useState(household.name)

const handleSave = async (newName: string) => {
  const previousName = name
  setName(newName) // optimistic
  try {
    const res = await fetch(`/api/households/${household.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    if (!res.ok) {
      setName(previousName) // revert on error
      throw new Error('Failed to rename household')
    }
  } catch {
    setName(previousName) // revert
    throw new Error('Erreur lors de la mise à jour du nom')
  }
}
```

### Keyboard Accessibility

- Pencil button: focusable, Enter/Space to activate
- Edit input: autofocus when entering edit mode
- Enter key to submit, Escape to cancel
- Tab order: input → save button → cancel button

### HouseholdCreateSchema Validation

Re-use the schema from Story 1.1 (`lib/schemas/household.ts`):
- Non-empty string: `.min(1)`
- Max 50 chars: `.max(50)`

Show the max-length constraint via `maxLength={50}` on the input element.

### revalidatePath('/household') Is Required

Per architecture Gap 4: `PUT /api/households/[id]` must call `revalidatePath('/household')` so the Server Component cache is invalidated and subsequent page loads reflect the new name.

### Demo Household — No Rename

If the household is demo (`is_demo = true`), the `InlineEditableField` should be rendered in read-only mode (no pencil icon). Check `is_demo` from the household data passed down from the Server Component (AC: from Story 4.1 implementation).

### References

- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#New Route Handlers`
- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Gap 4 (revalidatePath)`
- Architecture: `_bmad-output/planning-artifacts/architecture-v2.md#Conflict Point 1 (household ID from headers)`
- Epics: `_bmad-output/planning-artifacts/epics-v2.md#Story 4.2`
- Depends on: Story 4.1 (HouseholdMenuContent, household page)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- InlineEditableField: readOnly prop disables pencil icon (used for demo households)
- Optimistic rename in HouseholdMenuContent: setName updates immediately, reverts on API error
- PUT route validates id param vs x-household-id header (cross-household protection)
- DELETE handler for leave household also added to same file (Story 4.4 implementation)
- 54 tests passing (1 pre-existing RecipeCard carousel width failure)

### File List

- src/components/household/InlineEditableField.tsx (new)
- src/app/api/households/[id]/route.ts (new — PUT + DELETE)
- src/components/household/HouseholdMenuContent.tsx (modified — InlineEditableField + DeviceList + LeaveHouseholdDialog)
- src/app/(app)/household/page.tsx (modified — passes sessionId + devices)
- src/lib/i18n/fr.ts (modified — added device/leave strings)

### Change Log

- 2026-03-02: Implemented Story 4.2 — Household rename with InlineEditableField
