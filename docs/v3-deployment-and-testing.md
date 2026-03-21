# v3 Deployment — Manual Actions & Testing Checklist

Covers Epics 1 (AI Enrichment & Recipe Detail v3) and 2 (Edit Form v3 — Override AI & Photo Management).

---

## 1. Infrastructure Setup

### 1.1 OpenAI

- [X] Create an API key on [platform.openai.com](https://platform.openai.com/api-keys)
- [X] Ensure the key has access to **GPT-4o-mini** and **DALL-E 3**
- [X] Set a spending limit (enrichment costs ~$0.001/recipe, image ~$0.04/image)
- [X] Note the key — it goes in `OPENAI_SERVICE_KEY`

### 1.2 Supabase — Run Migration

Run `004_ai_enrichment.sql` against your Supabase project:

```bash
# Option A: Supabase CLI (if linked)
supabase db push

# Option B: SQL Editor in Supabase dashboard
# Paste the contents of supabase/migrations/004_ai_enrichment.sql
```

**What the migration does:**
- Creates `tags` table (UUID PK, name, category, is_predefined, household_id FK)
- Creates `recipe_tags` junction table (recipe_id, tag_id)
- Adds 11 columns to `recipes`: prep_time, cook_time, cost, complexity, seasons, image_prompt, generated_image_url, enrichment_status, image_status, last_viewed_at, view_count
- Seeds 48 predefined tags across 6 categories

**After migration, verify:**

```sql
-- Check tags were seeded
SELECT category, count(*) FROM tags WHERE is_predefined = true GROUP BY category ORDER BY category;
-- Expected: 6 categories, 48 total tags

-- Check columns exist on recipes
SELECT column_name FROM information_schema.columns
WHERE table_name = 'recipes' AND column_name IN ('enrichment_status', 'image_status', 'prep_time');
-- Expected: 3 rows
```

### 1.3 Supabase Storage — Generated Images Bucket

The enrichment pipeline uploads AI-generated images to Supabase Storage at `recipe-photos/generated/{recipeId}/ai-image.webp`.

- [X] Ensure the `recipe-photos` bucket exists (should already exist from v2 photo upload)
- [X] Ensure the bucket allows public reads (for `getPublicUrl()` to work)
- [X] Verify the service role key has write access (it should by default)

If the bucket doesn't exist:

```sql
-- In Supabase SQL editor
INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-photos', 'recipe-photos', true);
```

### 1.4 Vercel — Environment Variables

Add the following env var in Vercel project settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `OPENAI_SERVICE_KEY` | Your OpenAI API key | Production, Preview |

**Existing vars** (should already be set from v2):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SIGNING_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `DEMO_HOUSEHOLD_ID`
- `CRON_SECRET`

### 1.5 Vercel — Function Duration

The enrichment pipeline runs in `after()` callbacks. Verify your Vercel plan supports sufficient function execution time:

- Metadata enrichment (GPT-4o-mini): ~5-10s
- Image generation (DALL-E 3 + download + upload): ~15-30s
- Combined worst case: ~40s

- [X] Verify Vercel plan allows ≥60s function duration (Pro plan default)
- [X] Check that `after()` is supported on your deployment target (requires Node.js runtime, not Edge)

### 1.6 Local Development — .env.local

Add to your `.env.local`:

```
OPENAI_SERVICE_KEY=sk-...
```

---

## 2. Post-Deployment Verification

Quick smoke test after deploying and running the migration.

### 2.1 Database Health

```sql
-- Predefined tags loaded
SELECT count(*) FROM tags WHERE is_predefined = true;
-- Expected: 48

-- Existing recipes have default v3 values
SELECT enrichment_status, image_status, count(*)
FROM recipes GROUP BY enrichment_status, image_status;
-- Expected: all rows show 'none' / 'none'

-- recipe_tags junction is empty (no AI enrichment yet)
SELECT count(*) FROM recipe_tags;
-- Expected: 0
```

### 2.2 API Routes Respond

```bash
# Tags API (requires auth — test from browser console on the app)
fetch('/api/tags').then(r => r.json()).then(console.log)
# Expected: { tags: [...48+ tags...] }

# Status endpoint
fetch('/api/recipes/SOME_RECIPE_ID/status').then(r => r.json()).then(console.log)
# Expected: { enrichmentStatus: "none", imageStatus: "none" }
```

---

## 3. Manual Test Plan — Epic 1

### Test 1.1 — Create Recipe Triggers Enrichment

**Steps:**
1. Go to `/recipes/new`
2. Enter title: "Poulet rôti au thym"
3. Enter ingredients: "1 poulet entier\n4 branches de thym\n2 gousses d'ail\nSel, poivre\nHuile d'olive"
4. Enter steps: "Préchauffer le four à 200°C\nFrotter le poulet avec l'ail et le thym\nEnfourner 1h15\nArroser toutes les 20 min"
5. Tap "Enregistrer"

**Expected:**
- [X] Redirect to `/home` immediately (save < 500ms)
- [X] Toast "Ajoutée à votre bibliothèque" appears
- [X] Go to the recipe detail page (find it in library or home)
- [X] MetadataGrid shows shimmer blocks (Prép., Cuisson, Coût, Difficulté)
- [X] Tags/Seasons area shows shimmer pills
- [X] Image area shows shimmer or placeholder gradient
- [X] Within ~10s: metadata shimmers resolve to actual values (e.g. Prép. "30-45 min", Cuisson "1h - 2h", Coût "€€", Difficulté "moyen")
- [X] Tags appear as olive-tinted chips (e.g. "Plat principal", "Poulet", "Française")
- [X] Seasons appear as color-coded badges (e.g. "Automne", "Hiver")
- [X] Within ~30s: AI-generated image fades in (1024×1024 overhead illustration)
- [X] No page refresh required — polling triggers in-place reveal

### Test 1.2 — Enrichment Status Polling

**Steps:**
1. Create a recipe (Test 1.1)
2. Open browser dev tools → Network tab
3. Go to recipe detail page while enrichment is running

**Expected:**
- [X] See `GET /api/recipes/{id}/status` requests every ~3s
- [X] Response shows `{ enrichmentStatus: "pending", imageStatus: "pending" }`
- [X] When metadata resolves: `enrichmentStatus` changes to `"enriched"`
- [X] When image resolves: `imageStatus` changes to `"generated"`
- [X] Polling stops after both reach terminal state
- [X] No more requests after 60s regardless

### Test 1.3 — Fill Empty Only (Edit Preserves User Values)

**Steps:**
1. Create a recipe and wait for enrichment to complete
2. Note the AI-assigned values (e.g. Prép. "20-30 min", Coût "€€")
3. Go to edit → Change Prép. to "< 10 min" and Coût to "€"
4. Save
5. Wait for re-enrichment to complete (~10s)
6. Reload the detail page

**Expected:**
- [X] Prép. is still "< 10 min" (user value preserved)
- [X] Coût is still "€" (user value preserved)
- [X] Other AI-assigned fields unchanged (enrichment didn't overwrite them)
- [X] Tags remain unchanged (user had tags, so AI skipped tag assignment)

### Test 1.4 — Enrichment Failure Graceful Degradation

**Steps:**
1. Temporarily set `OPENAI_SERVICE_KEY` to an invalid value
2. Create a new recipe
3. Go to detail page

**Expected:**
- [ ] Recipe saves successfully (enrichment is async)
- [ ] MetadataGrid shows shimmers, then resolves to dashes ("—") after timeout
- [ ] No error toast shown to user
- [ ] In Supabase: `enrichment_status = 'failed'`
- [ ] After fixing the API key, editing and saving the recipe re-triggers enrichment

### Test 1.5 — Recipe Detail Page v3 Layout

**Steps:**
1. Open a fully enriched recipe

**Expected:**
- [ ] Hero image (4:3 aspect ratio, full width)
- [ ] Back button (frosted glass, top-left)
- [ ] Edit + Delete buttons (frosted glass, top-right)
- [ ] Title (serif font, 22px)
- [ ] MetadataGrid (2×2: Prép. | Cuisson | Coût | Difficulté)
- [ ] Divider → Ingredients (bulleted list)
- [ ] Divider → Steps (numbered, with olive circles)
- [ ] Divider → Tags (olive chips) + Seasons (colored badges)
- [ ] Image priority: user photo > generated image > placeholder gradient

### Test 1.6 — View Tracking

**Steps:**
1. Open a recipe detail page
2. Check Supabase: `SELECT last_viewed_at, view_count FROM recipes WHERE id = '...'`
3. Reload the page
4. Check again

**Expected:**
- [X] `last_viewed_at` updated to current timestamp
- [X] `view_count` incremented by 1 each visit
- [X] No visible latency from view tracking (fire-and-forget)

### Test 1.7 — Image Priority on Detail Page

**Steps:**
1. Create a recipe → wait for AI image generation
2. Verify generated image shows
3. Edit → upload your own photo → save
4. Verify your photo shows (takes priority over generated)
5. Edit → remove photo → save
6. Verify generated image resurfaces

**Expected:**
- [ ] User photo always takes priority over generated image
- [ ] Generated image shows when no user photo
- [ ] Placeholder gradient shows when neither exists

---

## 4. Manual Test Plan — Epic 2

### Test 2.1 — Tag Autocomplete (TagInput)

**Steps:**
1. Go to edit form for any recipe
2. Tap the "Ajouter un tag…" input
3. Start typing "pou"

**Expected:**
- [X] Dropdown opens with category-grouped suggestions
- [X] Tags filtered to matches (e.g. "Poulet" under "Protéine principale")
- [X] Category headers visible (uppercase, small, muted)
- [x] Already-selected tags hidden from suggestions
- [x] Accent-insensitive: typing "vege" matches "Végétarien"

### Test 2.2 — Tag Keyboard Navigation
**Steps:**
1. Focus the tag input
2. Press ArrowDown to open dropdown
3. Use ArrowDown/ArrowUp to navigate
4. Press Enter to select
5. Press Escape to close

**Expected:**
- [ ] Arrow keys highlight suggestions (olive accent background)
- [ ] Enter selects the highlighted tag → chip appears above input
- [ ] Escape closes dropdown
- [ ] Focus returns to input after selection

### Test 2.3 — Custom Tag Creation

**Steps:**
1. Type a tag name that doesn't exist (e.g. "Mon tag perso")
2. Look for "Créer 'Mon tag perso'" option at bottom of dropdown
3. Select it

**Expected:**
- [ ] "Créer '...'" option appears when no exact match
- [ ] Selecting it calls POST /api/tags
- [ ] New tag appears as a chip in the form
- [ ] Tag persists on save
- [ ] New tag appears in subsequent autocomplete (tagged as custom, category null)

### Test 2.4 — Tag Removal (1-Tap)

**Steps:**
1. In edit form, find a tag chip with × button
2. Tap the × button

**Expected:**
- [ ] Tag removed from form immediately
- [ ] Removed tag reappears in autocomplete suggestions
- [ ] aria-label reads "Retirer le tag {name}"

### Test 2.5 — Tag Persistence (Delete-Then-Insert)

**Steps:**
1. Edit a recipe with existing tags
2. Remove one tag, add two new ones
3. Save
4. Reload the edit form

**Expected:**
- [ ] Saved tags match what you set
- [ ] Check Supabase: `SELECT * FROM recipe_tags WHERE recipe_id = '...'`
- [ ] Old junction rows deleted, new ones inserted

### Test 2.6 — ChipSelector: Coût (Single-Select)

**Steps:**
1. In edit form, scroll to "Coût" section
2. Tap "€€"
3. Tap "€€€"
4. Tap "€€€" again

**Expected:**
- [ ] "€€" becomes selected (olive bg, white text, aria-pressed="true")
- [ ] Tapping "€€€" deselects "€€", selects "€€€" (single-select)
- [ ] Tapping "€€€" again deselects it (returns to null)

### Test 2.7 — ChipSelector: Saisons (Multi-Select)

**Steps:**
1. In edit form, scroll to "Saisons" section
2. Tap "Printemps"
3. Tap "Automne"
4. Tap "Printemps" again

**Expected:**
- [ ] Both "Printemps" and "Automne" selected simultaneously
- [ ] Tapping "Printemps" again deselects only that one
- [ ] Multiple seasons persist on save

### Test 2.8 — Prep/Cook Time Selects

**Steps:**
1. In edit form, find Prép. and Cuisson side-by-side
2. Select "20-30 min" for Prép.
3. Select "1h - 2h" for Cuisson
4. Save and reopen edit form

**Expected:**
- [ ] Side-by-side layout (2 columns, 12px gap)
- [ ] Options match spec exactly (Prép: 5 options, Cuisson: 6 options including "Aucune")
- [ ] Values pre-filled when editing
- [ ] Reset to "—" deselection works (selects empty option)

### Test 2.9 — Complexity Select

**Steps:**
1. In edit form, find "Difficulté" dropdown
2. Select "Moyen"
3. Save and reopen

**Expected:**
- [ ] Three options: Facile, Moyen, Difficile
- [ ] Display labels are capitalized (via i18n), stored values lowercase
- [ ] Pre-fills correctly on edit

### Test 2.10 — V3 Metadata Pre-Fill on Edit

**Steps:**
1. Create a recipe, wait for enrichment to complete
2. Open edit form

**Expected:**
- [ ] Prép. select pre-filled with AI value
- [ ] Cuisson select pre-filled
- [ ] Coût chip pre-selected
- [ ] Difficulté select pre-filled
- [ ] Saisons chips pre-selected
- [ ] Tags shown as removable chips

### Test 2.11 — PhotoManager: Has Photo State

**Steps:**
1. Edit a recipe that has a photo (user or AI-generated)

**Expected:**
- [ ] 4:3 image preview visible
- [ ] Three buttons below: Régénérer (if generated image exists), Remplacer, Supprimer
- [ ] Frosted glass button styling (white/85 opacity, backdrop blur)

### Test 2.12 — PhotoManager: Régénérer

**Steps:**
1. Edit a recipe with an AI-generated image
2. Tap "Régénérer"
3. Observe button state
4. Save

**Expected:**
- [ ] Button changes to "Régénération prévue" with accent tint
- [ ] Save sends `regenerateImage: true` in PUT body
- [ ] After save, detail page shows image shimmer → new image fades in
- [ ] New image is different from previous (re-generated)

### Test 2.13 — PhotoManager: Remplacer

**Steps:**
1. Edit a recipe with an existing photo
2. Tap "Remplacer"
3. Select a photo from device

**Expected:**
- [ ] Device file picker opens
- [ ] Selected photo appears immediately in preview (blob URL)
- [ ] Clears any pending regeneration
- [ ] On save, new photo uploaded via existing `usePhotoUpload` flow

### Test 2.14 — PhotoManager: Supprimer

**Steps:**
1. Edit a recipe with a photo
2. Tap "Supprimer"
3. Observe form state
4. Save

**Expected:**
- [ ] Preview switches to no-photo state (dashed border + camera icon)
- [ ] Clears pending regeneration and file selection
- [ ] On save: both `photo_url` and `generated_image_url` cleared in DB
- [ ] Detail page shows placeholder gradient

### Test 2.15 — PhotoManager: No Photo State

**Steps:**
1. Edit a recipe with no photo (or after removing)

**Expected:**
- [ ] Dashed border placeholder with camera icon
- [ ] "Ajouter une photo" label
- [ ] Tapping opens file picker
- [ ] No Régénérer/Remplacer/Supprimer buttons shown

### Test 2.16 — PhotoManager: Action Precedence

**Steps:**
1. Edit a recipe with generated image
2. Tap "Régénérer" → button shows "Régénération prévue"
3. Tap "Remplacer" → select a file
4. Observe state

**Expected:**
- [ ] Replace clears regenerate (Régénérer button returns to default state)
- [ ] Preview shows the selected file, not the old image
- [ ] If you then tap "Supprimer": clears file AND regenerate flag, shows placeholder

### Test 2.17 — Create Mode (No Existing Data)

**Steps:**
1. Go to `/recipes/new`

**Expected:**
- [ ] All v3 metadata fields empty/unselected
- [ ] TagInput shows empty state with no chips
- [ ] PhotoManager shows upload prompt (no Régénérer button)
- [ ] All fields are optional — can save with just a title
- [ ] After save, enrichment fills empty fields via AI

### Test 2.18 — Form Field Order

**Steps:**
1. Open edit form, scroll through all fields

**Expected order (top to bottom):**
- [ ] Titre (required)
- [ ] Photo (PhotoManager)
- [ ] Ingrédients (textarea)
- [ ] Préparation (textarea)
- [ ] Tags (TagInput with chips)
- [ ] Prép. / Cuisson (side-by-side selects)
- [ ] Coût (ChipSelector)
- [ ] Difficulté (select)
- [ ] Saisons (ChipSelector)
- [ ] Enregistrer (submit button)
- [ ] No divider between Tags and metadata fields

---

## 5. Cross-Epic Integration Tests

### Test 5.1 — Full Create→Enrich→Edit→Save Cycle

1. Create recipe with title + ingredients only
2. Wait for full enrichment (metadata + image)
3. Verify all AI fields on detail page
4. Edit → change some values (tags, cost, seasons)
5. Save → verify "fill empty only" preserved your changes
6. Edit again → verify your manual values are pre-filled

### Test 5.2 — Create With User-Provided V3 Fields

1. Create a new recipe
2. Before saving: set Prép., Coût, add 2 tags manually, select 2 seasons
3. Save
4. Wait for enrichment
5. Verify: your manual values preserved, AI only filled remaining nulls

### Test 5.3 — Photo Lifecycle

1. Create recipe → AI image generated
2. Edit → upload your own photo → save → verify your photo shows
3. Edit → tap Régénérer → save → verify new AI image (behind your photo)
4. Edit → Supprimer → save → verify generated image resurfaces (if regenerated)
5. Edit → Supprimer again → save → verify placeholder gradient shows

### Test 5.4 — Mobile Responsiveness

Test on a phone or mobile viewport (< 1024px):
- [ ] Form fields stack vertically
- [ ] ChipSelector chips wrap on small screens
- [ ] TagInput dropdown doesn't overflow viewport
- [ ] PhotoManager buttons row fits without overlap
- [ ] Sticky submit button visible above safe area
- [ ] MetadataGrid readable at small widths

---

## 6. Edge Cases

- [ ] Recipe with only a title (no ingredients/steps) → enrichment still works (AI infers what it can)
- [ ] Very long recipe (1000+ chars ingredients) → enrichment handles it
- [ ] Recipe with special characters (accents, emojis) → no crashes
- [ ] Rapid save-edit-save cycle → enrichment doesn't corrupt data
- [ ] Network offline during tag fetch → TagInput shows empty, no crash
- [ ] Two tabs open on same recipe → polling doesn't conflict
