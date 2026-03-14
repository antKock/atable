# Story 1.2: OpenAI Client & Enrichment Pipeline

Status: review

## Story

As a developer,
I want a centralized enrichment pipeline that calls GPT-4o-mini for metadata extraction and DALL-E 3 for image generation,
So that recipes can be automatically enriched with tags, seasons, time, cost, complexity, and a flat illustration.

## Acceptance Criteria

1. **OpenAI client** (`src/lib/openai.ts`): exports an OpenAI client singleton. This is the ONLY file that imports the `openai` SDK. Reads `OPENAI_API_KEY` from env.

2. **Enrichment Zod schema** (`src/lib/schemas/enrichment.ts`): defines the structured output schema for GPT-4o-mini: `tags` (array of predefined tag names, max 10), `seasons` (array from [printemps, ete, automne, hiver]), `prepTime` (from predefined ranges), `cookTime` (from predefined ranges), `cost` (€/€€/€€€), `complexity` (facile/moyen/difficile), `imagePrompt` (dish visual description). Used for both `zodResponseFormat` AND server-side `.parse()`.

3. **Enrichment pipeline** (`src/lib/enrichment.ts`): exports `enrichRecipe(id)` that:
   - Reads recipe (title, ingredients, steps) from DB
   - Sends to GPT-4o-mini with system prompt containing the complete predefined tag list, valid season/time/cost/complexity values
   - Validates response against Zod schema
   - Applies "fill empty only": only updates null scalar fields; tags only inserted if `recipe_tags` count === 0
   - Sets `enrichment_status = 'enriched'` on success
   - On create: generates DALL-E 3 image (1024×1024) using `imagePrompt` + fixed style suffix, downloads server-side, uploads to OVH Object Storage, stores URL + sets `image_status = 'generated'`
   - On edit: does NOT trigger image generation
   - On failure: retries with exponential backoff (3 attempts), then sets status to `'failed'`

4. **Image-only regeneration**: exports `regenerateImage(id)` that runs ONLY the DALL-E 3 → download → OVH upload pipeline without re-running metadata enrichment.

5. **Error handling**: enrichment failure never blocks recipe save. After 3 retries, `enrichment_status = 'failed'` and/or `image_status = 'failed'`. Recipe stays saved with whatever fields were already populated.

## Tasks / Subtasks

- [x] Task 1: Install `openai` npm package (AC: #1)
  - [x] `npm install openai`
  - [x] Add `OPENAI_SERVICE_KEY` to `.env.example` (already in `.env.local`)
- [x] Task 2: Create `src/lib/openai.ts` (AC: #1)
  - [x] OpenAI client singleton
  - [x] Export helper functions for GPT-4o-mini structured output call
  - [x] Export helper function for DALL-E 3 image generation
  - [x] Pin model versions (e.g., `gpt-4o-mini-2024-07-18`)
- [x] Task 3: Create `src/lib/schemas/enrichment.ts` (AC: #2)
  - [x] Define `EnrichmentResponseSchema` with all fields
  - [x] Use Zod v4 `.enum()` for constrained values
  - [x] Export for dual use: `zodResponseFormat` + `.parse()`
- [x] Task 4: Create `src/lib/enrichment.ts` (AC: #3, #4, #5)
  - [x] `enrichRecipe(id, isCreate: boolean)` — full pipeline
  - [x] `regenerateImage(id)` — image-only pipeline
  - [x] "Fill empty only" logic (scalar null check + tag junction row count)
  - [x] Retry with exponential backoff (3 attempts, 1s/2s/4s delays)
  - [x] Status column updates (only this file modifies status after initial `pending`)
  - [x] Image pipeline: DALL-E 3 call → fetch image URL → upload to Supabase Storage → persist
- [x] Task 5: Create OVH upload utility or extend existing pattern
  - [x] Server-side image download from DALL-E 3 URL
  - [x] Upload to Supabase Storage (same bucket as user photos, `generated/` prefix)
  - [x] Return stored URL

## Dev Notes

### Architecture constraints (CRITICAL)

- `lib/openai.ts` is the ONLY file that imports the `openai` SDK — never import it elsewhere
- `lib/enrichment.ts` owns ALL enrichment logic — Route Handlers only call `waitUntil(enrichRecipe(id))`
- `lib/schemas/enrichment.ts` is the SINGLE source of truth for the enrichment response shape
- Status columns (`enrichment_status`, `image_status`) are ONLY written by `lib/enrichment.ts` (except initial `pending` set by Route Handler)
- Image failure does NOT roll back metadata enrichment — they degrade independently

### OpenAI structured output pattern

```typescript
import { zodResponseFormat } from 'openai/helpers/zod'
import { EnrichmentResponseSchema } from '@/lib/schemas/enrichment'

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini-2024-07-18',
  response_format: zodResponseFormat(EnrichmentResponseSchema, 'enrichment'),
  messages: [
    { role: 'system', content: systemPrompt },  // includes full tag list + valid values
    { role: 'user', content: `Titre: ${title}\nIngrédients:\n${ingredients}\nPréparation:\n${steps}` }
  ]
})
const result = EnrichmentResponseSchema.parse(JSON.parse(response.choices[0].message.content))
```

**Note on Zod v4 + OpenAI SDK compatibility:** The OpenAI SDK's `zodResponseFormat` helper uses `.toJSONSchema()` internally. Verify this works with Zod v4 (^4.3.6). If not, manually construct the JSON schema and use `response_format: { type: 'json_schema', json_schema: { ... } }`.

### DALL-E 3 image generation pattern

```typescript
const imageResponse = await openai.images.generate({
  model: 'dall-e-3',
  prompt: `${imagePrompt}. Flat realistic illustration, overhead angle, neutral warm background, soft natural lighting.`,
  n: 1,
  size: '1024x1024',
})
const imageUrl = imageResponse.data[0].url  // Temporary URL — must download immediately
```

### OVH Object Storage upload

The existing photo upload uses **Supabase Storage** (client-side, via `usePhotoUpload` hook). However, the architecture doc specifies OVH Object Storage for generated images. Check if there's an OVH S3-compatible client already configured.

**Current photo upload flow** (for reference — Supabase Storage):
- `usePhotoUpload.ts` → `supabase.storage.from('recipe-photos').upload(path, file, { upsert: true })`
- Path pattern: `${deviceToken}/${recipeId}/photo.webp`
- Gets public URL via `supabase.storage.from('recipe-photos').getPublicUrl(path)`

**For generated images, use the same Supabase Storage pattern server-side** (simpler than setting up OVH, unless OVH is already configured):
- Path: `generated/${recipeId}/ai-image.webp`
- Upload server-side using service role client
- If OVH IS already configured, use that instead

### "Fill empty only" logic

```typescript
// Scalar fields — only fill if null
const updates: Record<string, unknown> = {}
if (!current.prep_time && result.prepTime) updates.prep_time = result.prepTime
if (!current.cook_time && result.cookTime) updates.cook_time = result.cookTime
// ... etc for cost, complexity, seasons, image_prompt

// Tags — only fill if no existing tags
const { count } = await supabase.from('recipe_tags').select('*', { count: 'exact', head: true }).eq('recipe_id', id)
if (count === 0) {
  // Look up tag IDs from predefined tags table, insert into recipe_tags
}
```

### Retry with exponential backoff

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      const isRetryable = error.status === 429 || error.status === 500 || error.status === 503
      if (!isRetryable) throw error
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }
  }
  throw new Error('Unreachable')
}
```

### System prompt for GPT-4o-mini

The system prompt MUST include:
- Complete list of predefined tag names (the ~50+ from Story 1.1)
- Valid season values: printemps, ete, automne, hiver
- Valid prep time ranges: < 10 min, 10-20 min, 20-30 min, 30-45 min, > 45 min
- Valid cook time ranges: Aucune, < 15 min, 15-30 min, 30 min - 1h, 1h - 2h, > 2h
- Valid cost levels: €, €€, €€€
- Valid complexity levels: facile, moyen, difficile
- Instruction to select ONLY from the provided lists
- Instruction to generate a visual dish description for imagePrompt (used for DALL-E)

### Dependencies

- **Story 1.1 must be complete** — this story depends on the v3 DB schema, types, and mapper
- `openai` npm package (new dependency)
- `OPENAI_API_KEY` environment variable

### Project Structure Notes

- New files: `src/lib/openai.ts`, `src/lib/enrichment.ts`, `src/lib/schemas/enrichment.ts`
- Modified: `.env.example`, `.env.local`, `package.json`
- All 3 new files in `src/lib/` — follows existing module organization

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#OpenAI-Specific Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Enrichment-Specific Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions > API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Gap Analysis Results]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2]
- [Source: _bmad-output/planning-artifacts/prd.md#AI Enrichment (FR1-FR6)]
- [Source: _bmad-output/planning-artifacts/prd.md#AI Image Generation (FR7-FR12)]
- [Source: src/hooks/usePhotoUpload.ts — existing photo upload pattern]
- [Source: src/lib/supabase/server.ts — service role client for server-side operations]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- Created `src/lib/openai.ts` — singleton OpenAI client reading `OPENAI_SERVICE_KEY` from env.
- Created `src/lib/schemas/enrichment.ts` — Zod v4 schema with enums for all constrained values (seasons, prep/cook times, cost, complexity). Exported for both validation and JSON schema generation.
- Created `src/lib/enrichment.ts` — full enrichment pipeline with `enrichRecipe(id, isCreate)` and `regenerateImage(id)`. Includes: GPT-4o-mini structured output call with complete predefined tag list in system prompt, "fill empty only" logic, retry with exponential backoff (3 attempts), DALL-E 3 image generation (create-only), server-side download and upload to Supabase Storage.
- Used manual JSON schema for `response_format` instead of `zodResponseFormat` helper to avoid Zod v4 compatibility issues with OpenAI SDK.
- Image upload uses Supabase Storage (`recipe-photos` bucket, `generated/{recipeId}/ai-image.webp` path) — simpler than setting up OVH and consistent with existing photo infrastructure.
- Added `OPENAI_SERVICE_KEY` to `.env.example`.
- All 55 existing tests pass, TypeScript compiles clean.

### Change Log

- 2026-03-14: Story 1.2 implemented — OpenAI client, enrichment Zod schema, full enrichment pipeline with retry + image generation

### File List

- src/lib/openai.ts (new)
- src/lib/schemas/enrichment.ts (new)
- src/lib/enrichment.ts (new)
- .env.example (modified)
- package.json (modified — added openai dependency)
- package-lock.json (modified)
