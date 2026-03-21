---
title: 'Recipe Import — Screenshot OCR & URL Scraping'
slug: 'recipe-import'
created: '2026-03-15'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16', 'OpenAI gpt-4o (vision)', 'OpenAI gpt-4o-mini', 'Zod', 'Tailwind CSS v4']
files_to_modify:
  - 'src/app/(app-fullscreen)/recipes/new/page.tsx'
  - 'src/components/recipes/ImportSelector.tsx (new)'
  - 'src/app/api/recipes/import/screenshot/route.ts (new)'
  - 'src/app/api/recipes/import/url/route.ts (new)'
  - 'src/lib/import.ts (new)'
  - 'src/lib/schemas/import.ts (new)'
  - 'src/lib/i18n/fr.ts'
code_patterns: ['OpenAI singleton from src/lib/openai.ts', 'Zod validation on API routes', 'after() for background enrichment', 'RecipeFormData pre-fill']
test_patterns: ['Zod schema unit tests', 'API route integration tests']
---

# Tech-Spec: Recipe Import — Screenshot OCR & URL Scraping

**Created:** 2026-03-15

## Overview

### Problem Statement
Users currently must manually type all recipe data into the capture form. Most recipes are discovered as screenshots (social media, cooking apps) or URLs (recipe websites). Manual entry is slow and error-prone.

### Solution
Add an **intent screen** at `/recipes/new` that offers three creation methods:
1. **Screenshot OCR** — Upload one or more images → OpenAI gpt-4o vision extracts recipe data → pre-fills the existing capture form
2. **URL scraping** — Paste a recipe URL → server fetches HTML → OpenAI gpt-4o-mini structures the content → pre-fills the existing capture form
3. **Manual entry** — Existing form, unchanged

Both AI paths produce a `RecipeFormData` object that pre-fills the existing `RecipeForm` component. The user reviews, edits if needed, and submits as usual. No database schema changes.

### Scope

**In Scope:**
- New intent screen replacing direct form render at `/recipes/new`
- Screenshot OCR via OpenAI gpt-4o vision (multi-image support)
- URL scraping via server-side fetch + OpenAI gpt-4o-mini structuring
- Loading/error states during AI processing
- Pre-filling the existing RecipeForm with extracted data
- French UI strings via `t` object

**Out of Scope:**
- Camera capture (native file picker is sufficient)
- Saving import history or source URLs in the database
- Batch import (multiple recipes at once)
- Recipe deduplication
- Changes to the existing RecipeForm component itself
- Changes to the database schema

## Context for Development

### Codebase Patterns

1. **OpenAI client** — Singleton in `src/lib/openai.ts`, reads `OPENAI_SERVICE_KEY` env var. All AI calls go through this client.

2. **Existing enrichment pattern** — `src/lib/enrichment.ts` uses `gpt-4o-mini` with structured JSON output and retry logic (3 attempts, exponential backoff). Same retry pattern should be reused for import.

3. **API route validation** — All route handlers validate input with Zod schemas before processing. Use `createServerClient()` for any Supabase calls (though import routes won't need DB access).

4. **Form pre-fill** — `RecipeForm` accepts `initialData?: RecipeFormData` prop (used by edit mode). The import flow will pass extracted data as `initialData` to the same component in create mode.

5. **Fire-and-forget enrichment** — After recipe creation, `after()` runs enrichment. Import-created recipes will go through the same post-creation enrichment pipeline automatically.

6. **French UI** — All user-facing strings come from `src/lib/i18n/fr.ts` via the `t` object.

7. **Fullscreen layout** — `/recipes/new` uses the `(app-fullscreen)` layout group (no bottom nav). The intent screen should use this same layout.

### Files to Reference
| File | Purpose |
| ---- | ------- |
| `src/lib/openai.ts` | OpenAI singleton client — reuse for all AI calls |
| `src/lib/enrichment.ts` | Enrichment pipeline — reference retry pattern and structured output approach |
| `src/lib/schemas/enrichment.ts` | Enrichment JSON schema — reference for structured output pattern |
| `src/lib/schemas/recipe.ts` | `RecipeCreateSchema` and `RecipeFormData` type |
| `src/types/recipe.ts` | `RecipeFormData` type definition |
| `src/components/recipes/RecipeForm.tsx` | Existing form — receives `initialData` prop |
| `src/app/(app-fullscreen)/recipes/new/page.tsx` | Current page — will become intent screen router |
| `src/lib/i18n/fr.ts` | French strings |
| `_bmad-output/mockups/new-recipe-intent-screen.html` | **UX mockup — follow this design precisely** |

### Technical Decisions

1. **gpt-4o for OCR, gpt-4o-mini for URL** — Vision requires gpt-4o. URL scraping only needs text processing, so gpt-4o-mini is cheaper and faster.

2. **Server-side HTML fetch for URLs** — Fetch the page HTML server-side, extract text content (strip scripts/styles/nav), then send cleaned text to OpenAI. Don't send raw HTML — too many tokens, unreliable.

3. **No new DB tables** — Import is a transient operation. The output is a pre-filled form, not a stored entity. The recipe only hits the DB when the user submits the form (existing flow).

4. **Client-side state for pre-fill** — After the API returns extracted data, pass it to RecipeForm via React state (URL search params or component state). No need for server-side sessions or temp storage.

5. **Multi-image OCR** — Send all images as separate `image_url` content blocks in a single gpt-4o message. The model sees all images together and merges them into one recipe.

6. **Max image size** — Accept images up to 10 MB each, max 5 images. Resize client-side to max 2048px on longest edge before uploading (reduces API cost and latency). Send as base64 data URIs.

7. **URL text extraction** — Fetch HTML server-side, strip `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>` tags via regex, then extract text content. Always send cleaned text to gpt-4o-mini for structuring — no JSON-LD shortcut (too unreliable: incomplete data, malformed markup, inconsistent across sites).

## Implementation Plan

### Tasks

- [x] Task 1: Create import Zod schemas
  - File: `src/lib/schemas/import.ts` (new)
  - Action: Define `ImportScreenshotSchema` (array of base64 strings, max 5) and `ImportUrlSchema` (single URL string). Define `ImportResultSchema` matching `RecipeFormData` fields that OpenAI should extract: `title`, `ingredients`, `steps`, `prepTime`, `cookTime`, `cost`, `complexity`, `seasons`. All fields optional except `title`.

- [x] Task 2: Create import service functions
  - File: `src/lib/import.ts` (new)
  - Action: Implement two functions:
    - `extractRecipeFromImages(base64Images: string[]): Promise<RecipeFormData>` — Builds a gpt-4o message with system prompt (French recipe extraction instructions + output JSON schema) and user content containing all images as `image_url` blocks. Uses structured output with `ImportResultSchema`. Includes retry logic (reuse pattern from `enrichment.ts`).
    - `extractRecipeFromUrl(url: string): Promise<RecipeFormData>` — Fetches URL server-side, strips HTML to clean text content (remove script/style/nav/header/footer tags), sends to gpt-4o-mini with extraction prompt. Uses structured output with same `ImportResultSchema`. Includes retry logic.
  - Notes: System prompts should instruct the model to output in French. Map OpenAI response to `RecipeFormData` shape (with null defaults for missing fields). Import `openai` from `src/lib/openai.ts`.

- [x] Task 3: Create screenshot import API route
  - File: `src/app/api/recipes/import/screenshot/route.ts` (new)
  - Action: POST handler that validates body with `ImportScreenshotSchema`, calls `extractRecipeFromImages()`, returns the `RecipeFormData` JSON. Handle errors: 400 for validation, 422 for OpenAI extraction failure, 500 for unexpected errors. No auth required (personal app).

- [x] Task 4: Create URL import API route
  - File: `src/app/api/recipes/import/url/route.ts` (new)
  - Action: POST handler that validates body with `ImportUrlSchema`, calls `extractRecipeFromUrl()`, returns the `RecipeFormData` JSON. Handle errors: 400 for validation, 422 for extraction failure (bad URL, blocked site, no recipe found), 500 for unexpected errors.

- [x] Task 5: Add French strings for import UI
  - File: `src/lib/i18n/fr.ts`
  - Action: Add import-related strings to `t` object:
    ```
    import.title: "Nouvelle recette"
    import.subtitle: "Comment souhaitez-vous ajouter votre recette ?"
    import.screenshot.title: "Depuis une photo"
    import.screenshot.description: "Importez une capture d'écran ou photo de recette"
    import.screenshot.upload: "Choisir des images"
    import.screenshot.uploadHint: "Plusieurs images possibles — JPG, PNG — max 10 Mo"
    import.screenshot.analyze: "Analyser"
    import.screenshot.count: (n) => `${n} image${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''}`
    import.url.title: "Depuis un lien"
    import.url.description: "Collez l'URL d'une recette en ligne"
    import.url.placeholder: "https://marmiton.org/recette/..."
    import.manual.title: "Saisie manuelle"
    import.manual.description: "Remplir le formulaire directement"
    import.divider: "ou"
    import.loading: "Extraction de la recette en cours..."
    import.error: "Impossible d'extraire la recette. Réessayez ou saisissez-la manuellement."
    ```

- [x] Task 6: Create ImportSelector client component
  - File: `src/components/recipes/ImportSelector.tsx` (new)
  - Action: **Follow the mockup at `_bmad-output/mockups/new-recipe-intent-screen.html` precisely.** Build a "use client" component implementing the intent screen with three option cards:
    - **Screenshot card** (primary): Olive icon circle with image icon, 52px. On click, card expands inline (`flex-wrap: wrap`, `flex-basis: 100%` for expanded content). Shows upload area with dashed border. File input accepts `image/*` with `multiple` attribute. After selection, upload area is replaced by a thumbnail preview grid (72px rounded thumbs with x-remove buttons + dashed "+" add-more button). Below grid: file count label + olive "Analyser" submit button. Client-side resize images to max 2048px before converting to base64.
    - **URL card** (primary): Same style. Expands inline to show URL text input + round olive submit button.
    - **Manual card** (secondary): Dashed border, muted colors, smaller (44px icon circle). Links directly to form.
    - **"ou" divider** between primary and secondary cards.
    - Arrow icon rotates 90° when card is expanded. Only one primary card expanded at a time.
    - On submit (screenshot or URL): show loading state on the card (spinner replacing submit button, disable interactions). On success: call `onImportComplete(data: RecipeFormData)` callback. On error: show inline error message with retry option.
  - Notes: Use existing design system classes (`bg-surface`, `border-border`, `text-accent`, `rounded-xl`, etc.). All strings from `t` object. Touch targets min 44px.

- [x] Task 7: Update `/recipes/new` page to use ImportSelector
  - File: `src/app/(app-fullscreen)/recipes/new/page.tsx`
  - Action: Replace direct `<RecipeForm mode="create" />` render with a client component that manages state:
    - State: `importedData: RecipeFormData | null` (initially null)
    - When `importedData` is null: render `<ImportSelector onImportComplete={setImportedData} />`
    - When `importedData` is set: render `<RecipeForm mode="create" initialData={importedData} stickySubmit />`
    - Add a "Retour" back button in the form view that resets `importedData` to null (back to intent screen)
  - Notes: This may require extracting the page into a wrapper client component (e.g., `NewRecipePage.tsx`) since the page itself is a server component. The "Retour" button from the intent screen should navigate back (router.back()), while the back button in the pre-filled form view should reset to the intent screen.

- [x] Task 8: Client-side image resizing utility
  - File: `src/lib/image-resize.ts` (new)
  - Action: Implement `resizeImageToBase64(file: File, maxDimension: number = 2048): Promise<string>` — Uses canvas API to resize the image if either dimension exceeds `maxDimension`, maintaining aspect ratio. Returns base64 data URI string. Handles EXIF orientation. For images already within limits, still converts to base64 without resizing.

### Acceptance Criteria

- [ ] AC 1: Given I tap the "+" button, when the `/recipes/new` page loads, then I see the intent screen with three options (screenshot, URL, manual) matching the mockup design — not the form directly.

- [ ] AC 2: Given I tap "Depuis une photo", when the card expands, then I see the image upload area with dashed border and "Choisir des images" label. Only one primary card is expanded at a time.

- [ ] AC 3: Given I select 3 images, when they load, then I see 3 thumbnail previews (72px, rounded) with remove buttons, a "+" add-more button, a count label "3 images sélectionnées", and an "Analyser" button.

- [ ] AC 4: Given I tap "Analyser" with images selected, when OpenAI processes them, then I see a loading state, and on success the capture form appears pre-filled with the extracted recipe data (title, ingredients, steps, and any detected metadata).

- [ ] AC 5: Given I tap "Depuis un lien" and paste a valid recipe URL, when I submit, then the recipe is extracted and the form appears pre-filled with the data.

- [ ] AC 6: Given OCR or URL extraction fails, when the error is returned, then I see an inline error message with a retry option and a link to manual entry. The app does not crash or show a blank screen.

- [ ] AC 8: Given I tap "Saisie manuelle", when navigating, then I see the existing capture form unchanged (no regression).

- [ ] AC 9: Given the form is pre-filled from import, when I submit it, then the recipe is created normally and the existing enrichment pipeline runs as usual via `after()`.

- [ ] AC 10: Given I am on the pre-filled form after import, when I tap "Retour", then I return to the intent screen (not browser back).

## Additional Context

### Dependencies
- `openai` package (already installed)
- No new packages required. HTML text extraction uses built-in regex/string manipulation (server-side). Image resizing uses browser Canvas API (client-side).

### Testing Strategy
- **Unit tests**: Zod import schemas (valid/invalid inputs), image resize utility (dimension calculations)
- **Integration tests**: API routes with mocked OpenAI responses (screenshot + URL)
- **Manual testing**: Real screenshots from Instagram/TikTok/Paprika, real URLs from marmiton.org, cuisineaz.com, 750g.com

### Notes
- The existing `after()` enrichment pipeline will still run on recipes created via import. This is intentional — enrichment fills in any metadata the import missed (tags, cost, complexity, seasons, generated image). Import extracts the "core" recipe data (title, ingredients, steps, times), enrichment handles the rest.
- Images are NOT stored from the import step. They're only used transiently for OCR. Recipe photos come from the existing photo upload flow or DALL-E generation via enrichment.
- Consider rate limiting the import endpoints in the future if abuse becomes a concern (not needed now for personal app).
