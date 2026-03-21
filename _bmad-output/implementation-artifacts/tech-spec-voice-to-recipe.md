---
title: 'Voice-to-Recipe (Dictée vocale)'
slug: 'voice-to-recipe'
created: '2026-03-21'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16', 'TypeScript', 'Tailwind CSS v4', 'OpenAI SDK (Whisper + GPT-4o-mini)', 'Web Audio API', 'MediaRecorder API']
files_to_modify: ['src/lib/import.ts', 'src/lib/schemas/import.ts', 'src/app/api/recipes/import/voice/route.ts', 'src/components/recipes/ImportSelector.tsx', 'src/hooks/useVoiceRecorder.ts', 'src/lib/i18n/fr.ts']
code_patterns: ['Import route: validate schema → call extraction fn → return ImportedRecipeData', 'OpenAI structured output with json_schema response_format', 'withRetry wrapper for OpenAI calls', 'ImportError class for typed error codes', 'Accordion card UI in ImportSelector']
test_patterns: ['Vitest for hooks (see src/hooks/__tests__)', 'Mock fetch for API tests']
---

# Tech-Spec: Voice-to-Recipe (Dictée vocale)

**Created:** 2026-03-21

## Overview

### Problem Statement

Users currently have 3 recipe import methods (screenshot, URL, manual). There's no way to capture a recipe by speaking — the most natural method when in the kitchen with messy hands or when hearing a recipe from someone verbally.

### Solution

Add a 4th import option — voice dictation. The user records audio in-browser via MediaRecorder, the backend transcribes it with OpenAI Whisper (`language: "fr"`, 95% French usage), then structures the transcription into recipe JSON using the **existing** `EXTRACTION_SYSTEM_PROMPT` + `IMPORT_JSON_SCHEMA` pipeline. The result pre-fills the recipe form exactly like screenshot and URL imports.

### Scope

**In Scope:**
- `POST /api/recipes/import/voice` endpoint (Whisper transcription → GPT-4o-mini structuring)
- `useVoiceRecorder` hook (MediaRecorder + Web Audio API waveform visualizer)
- Voice card in `ImportSelector.tsx` as 2nd option (after photo, before URL)
- Option A compact layout — tighter collapsed cards to fit 4 options without scrolling
- French strings in `fr.ts`
- Browser compatibility check (hide card if no MediaRecorder support)

**Out of Scope:**
- Streaming/real-time transcription
- Showing raw transcription to user
- Re-recording / "continue dictating" within same flow
- Multi-speaker diarization
- Multilingual language detection (hardcoded `fr`)

## Context for Development

### Codebase Patterns

- **Import route pattern**: Zod schema validation → extraction function in `import.ts` → return `ImportedRecipeData` type (`Omit<RecipeFormData, "tags" | "photoUrl">`)
- **OpenAI usage**: Singleton client in `src/lib/openai.ts` using `OPENAI_SERVICE_KEY` env var. All calls use `withRetry()` wrapper from `src/lib/retry.ts`
- **Structured output**: GPT calls use `response_format: { type: "json_schema", json_schema: IMPORT_JSON_SCHEMA }` — enforces valid JSON at API level
- **Error handling**: `ImportError` class with typed codes (`SITE_BLOCKED`, `SITE_UNREACHABLE`, `EXTRACTION_FAILED`). Route handlers map these to HTTP status codes
- **Auth**: All import routes check `x-household-id` header (401 if missing)
- **UI**: `ImportSelector.tsx` uses accordion pattern — `ExpandedCard` union type controls which card is open. Only one card expanded at a time

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/lib/import.ts` | Extraction functions + `EXTRACTION_SYSTEM_PROMPT` + `IMPORT_JSON_SCHEMA` + `toFormData()` — **reuse for voice** |
| `src/lib/schemas/import.ts` | `ImportScreenshotSchema`, `ImportUrlSchema`, `ImportResultSchema` — add `ImportVoiceSchema` here |
| `src/lib/openai.ts` | OpenAI singleton client — reuse as-is |
| `src/lib/retry.ts` | `withRetry()` wrapper — reuse for Whisper + GPT calls |
| `src/app/api/recipes/import/screenshot/route.ts` | Reference pattern for the voice route |
| `src/app/api/recipes/import/url/route.ts` | Reference pattern for error handling (ImportError + rate limit) |
| `src/components/recipes/ImportSelector.tsx` | Add voice card + compact layout changes |
| `src/components/recipes/NewRecipeFlow.tsx` | Parent component — may need `ExpandedCard` type update |
| `src/hooks/useVoiceRecorder.ts` | **New file** — MediaRecorder + Web Audio API waveform |
| `src/lib/i18n/fr.ts` | French strings — add voice section |
| `src/lib/schemas/enrichment.ts` | Enum values used in system prompt (reference only) |

### Technical Decisions

- **Whisper `language: "fr"` hardcoded** — 95% French usage, skips language detection for better accuracy and speed. One-line change if multilingual needed later
- **Endpoint naming**: `POST /api/recipes/import/voice` — consistent with `/import/screenshot` and `/import/url`
- **Reuse existing extraction pipeline**: Same `EXTRACTION_SYSTEM_PROMPT`, `IMPORT_JSON_SCHEMA`, and `toFormData()` — voice just adds a user message hint about oral input
- **Audio format**: `webm/opus` — native browser support + Whisper-compatible
- **File size limit**: 10 MB server-side (3 min webm/opus ≈ 1-3 MB, generous buffer)
- **Duration limit**: 3 minutes client-side (timer + auto-stop)
- **Waveform**: Web Audio API `AnalyserNode` + `<canvas>` or CSS bars — ~40-50 lines in hook, no external library
- **Option A compact layout**: Reduce icon 52→40px, hide description when collapsed, padding `p-5`→`p-3.5`

## Implementation Plan

### Tasks

- [x] Task 1: Add Zod validation schema for voice import
  - File: `src/lib/schemas/import.ts`
  - Action: Add `ImportVoiceSchema` — no schema needed for the multipart body itself, but add a constant for `MAX_VOICE_FILE_SIZE = 10 * 1024 * 1024` (10 MB)
  - Notes: The file arrives as FormData (not JSON), so Zod validates after parsing. Validate file type (webm, ogg, mp4, mpeg) and size

- [x] Task 2: Add `extractRecipeFromVoice()` function
  - File: `src/lib/import.ts`
  - Action: Add new export function that:
    1. Calls `openai.audio.transcriptions.create()` with `{ model: "whisper-1", language: "fr", response_format: "text" }` and the audio `File`
    2. Passes transcription to `openai.chat.completions.create()` using the existing `EXTRACTION_SYSTEM_PROMPT` + `IMPORT_JSON_SCHEMA`, with user message: `"Extrais la recette depuis cette transcription orale. Attention : peut contenir des hésitations, répétitions, ou corrections ('ah non, 200g pas 300') — utilise toujours la dernière valeur donnée :\n\n${transcription}"`
    3. Parses response with `ImportResultSchema` and returns `toFormData(parsed)`
    4. Both API calls wrapped in `withRetry()`
  - Notes: Add `TRANSCRIPTION_FAILED` to the `ImportError` code union type

- [x] Task 3: Create voice import API route
  - File: `src/app/api/recipes/import/voice/route.ts` **(new file)**
  - Action: Create `POST` handler following screenshot/url route pattern:
    1. Check `x-household-id` header (401)
    2. Parse `request.formData()` — extract the `audio` field
    3. Validate: file exists, size ≤ 10 MB, MIME type is audio/*
    4. Call `extractRecipeFromVoice(audioFile)`
    5. Return `NextResponse.json(formData)`
    6. Error handling: `ImportError` → 422 with code, rate limit → 429, generic → 422 with `EXTRACTION_FAILED`
  - Notes: Use `formData()` not `json()` — audio is binary. Pass the File directly to the OpenAI SDK (it accepts File objects)

- [x] Task 4: Add French strings for voice import
  - File: `src/lib/i18n/fr.ts`
  - Action: Add under `t.import.voice`:
    - `title`: "Dictée vocale"
    - `description`: "Dictez votre recette à voix haute"
    - `record`: "Appuyez pour dicter"
    - `recording`: "Enregistrement en cours…"
    - `processing`: "Analyse de la recette…"
    - `stop`: "Arrêter"
    - `maxDuration`: "3 minutes max"
    - `error`: "Impossible d'extraire la recette depuis l'audio"
    - `errorNoMic`: "Accès au microphone refusé"
    - `errorUnsupported`: "Votre navigateur ne supporte pas l'enregistrement audio"

- [x] Task 5: Create `useVoiceRecorder` hook
  - File: `src/hooks/useVoiceRecorder.ts` **(new file)**
  - Action: Create hook that returns `{ isRecording, duration, isSupported, waveformData, start, stop, audioBlob }`:
    1. **Browser check**: `isSupported = typeof MediaRecorder !== 'undefined' && navigator.mediaDevices?.getUserMedia`
    2. **start()**: Request mic via `getUserMedia({ audio: true })`, create `MediaRecorder` (mimeType: `audio/webm;codecs=opus` with fallback to `audio/webm`), create `AudioContext` + `AnalyserNode` connected to stream, start `requestAnimationFrame` loop reading `getByteFrequencyData()` into `waveformData` (Uint8Array), start timer counting up, auto-stop at 180s
    3. **stop()**: Stop MediaRecorder, stop all tracks on stream, disconnect AudioContext, assemble chunks into Blob, set `audioBlob`
    4. **Cleanup**: Stop everything on unmount
    5. **duration**: Elapsed seconds since recording started (updated via `setInterval` every 100ms)
    6. **waveformData**: `Uint8Array` updated at ~30fps via `requestAnimationFrame` — consumers render bars from this
  - Notes: No external libraries needed. ~60-80 lines total

- [x] Task 6: Compact card layout (Option A)
  - File: `src/components/recipes/ImportSelector.tsx`
  - Action: Modify all existing cards:
    1. Icon circles: `h-[52px] w-[52px]` → `h-10 w-10`, icon size 24 → 20
    2. Card padding: `p-5` → `p-3.5`
    3. Wrap description `<p>` in conditional: only render when `expanded === thisCard`
    4. Manual card: icon `h-11 w-11` → `h-10 w-10`, padding `p-4` → `p-3.5`
  - Notes: These are CSS-only changes to existing cards. Test on mobile viewport (375px width) to confirm all 4 cards + divider fit without scroll

- [x] Task 7: Add voice card to ImportSelector
  - File: `src/components/recipes/ImportSelector.tsx`
  - Action:
    1. Update `ExpandedCard` type: `"screenshot" | "url" | "voice" | null`
    2. Import `Mic` icon from `lucide-react`
    3. Add voice card between screenshot and URL cards — same accordion pattern
    4. Collapsed state: 🎤 icon + title "Dictée vocale" (no description per Option A)
    5. Expanded state:
       - If `!isSupported`: show disabled message from `t.import.voice.errorUnsupported`
       - Idle: Large mic button (centered, rounded-full, bg-accent, 64px) + "3 minutes max" label
       - Recording: Waveform visualizer (canvas or CSS bars reading from `waveformData`), timer showing `mm:ss`, stop button (red, rounded-full)
       - Processing: Loader2 spinner + "Analyse de la recette…"
    6. On stop: send `audioBlob` via `FormData` to `/api/recipes/import/voice`, call `onImportComplete(data)` on success
    7. Add `AbortController` support matching existing pattern (`abortRef`)
  - Notes: The waveform can be ~20 CSS bars with heights derived from `waveformData` sampled at even intervals. Simple `div` bars with `transition-all duration-75` for smooth animation. No canvas needed.

- [x] Task 8: Update NewRecipeFlow if needed
  - File: `src/components/recipes/NewRecipeFlow.tsx`
  - Action: Check if `ExpandedCard` type is imported/used here. If so, update the type. Otherwise no changes needed.
  - Notes: Likely no changes — `ExpandedCard` is defined locally in `ImportSelector.tsx`

### Acceptance Criteria

- [ ] AC1: Given a user on `/recipes/new`, when the page loads on a browser supporting MediaRecorder, then 4 import cards are visible without scrolling (screenshot, voice, URL, manual)
- [ ] AC2: Given a user on `/recipes/new`, when the page loads on a browser WITHOUT MediaRecorder support, then only 3 import cards are visible (voice card hidden)
- [ ] AC3: Given a user taps the voice card, when it expands, then a microphone button and "3 minutes max" label are shown
- [ ] AC4: Given a user taps the mic button, when the browser grants microphone permission, then recording starts with a waveform visualizer and a timer counting up
- [ ] AC5: Given a user is recording, when the timer reaches 3:00, then recording auto-stops and the audio is submitted for processing
- [ ] AC6: Given a user taps stop before 3:00, when the recording stops, then the audio is submitted for processing
- [ ] AC7: Given valid audio is submitted, when the backend processes it, then Whisper transcribes with `language: "fr"` and GPT-4o-mini structures the result using the existing recipe JSON schema
- [ ] AC8: Given the backend returns structured recipe data, when the frontend receives it, then the recipe form is pre-filled with the extracted data (title, ingredients, steps, metadata)
- [ ] AC9: Given the browser denies microphone access, when the user taps record, then an error message "Accès au microphone refusé" is shown
- [ ] AC10: Given the backend fails (Whisper or GPT error), when the error propagates, then the user sees "Impossible d'extraire la recette depuis l'audio"
- [ ] AC11: Given the collapsed card layout, when all 4 cards are collapsed, then icons are 40px, descriptions are hidden, and padding is `p-3.5`

## Additional Context

### Dependencies

- **OpenAI SDK** (`openai` package) — already installed, supports `audio.transcriptions.create()` natively
- **No new npm dependencies** — Web Audio API and MediaRecorder are browser-native
- **Environment**: `OPENAI_SERVICE_KEY` already configured

### Testing Strategy

- **Unit tests**: `useVoiceRecorder` hook — test `isSupported` detection, start/stop lifecycle, duration timer, auto-stop at 180s (mock MediaRecorder + AudioContext)
- **API route**: Test validation (missing audio, oversized file, wrong MIME type), test error mapping (ImportError codes → HTTP status)
- **Manual testing**: Record a real recipe dictation in French, verify form pre-fill accuracy. Test on iOS Safari + Chrome Android for MediaRecorder compatibility. Test mic permission denial flow.

### Notes

- **Cost**: Whisper $0.006/min + GPT-4o-mini ~$0.001/call = ~$0.02 per 3-minute recipe — negligible
- **Whisper language**: Hardcoded `"fr"` — if multilingual needed, change to `undefined` (auto-detect) in one line
- **Future considerations** (out of scope): re-recording without leaving flow, "continue dictating" for long recipes, streaming transcription
- **webm/opus fallback**: Some older iOS Safari versions may not support `audio/webm` — MediaRecorder will use `audio/mp4` as fallback, which Whisper also accepts
