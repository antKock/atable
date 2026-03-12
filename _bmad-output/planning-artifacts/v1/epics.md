---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
---

# atable - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for atable, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Recipe Management**
- FR1: A user can create a new recipe with only a title as the required field
- FR2: A user can add optional content to a recipe: ingredients, steps, tags, and one photo
- FR3: A user can view the full detail of any recipe in their library
- FR4: A user can edit any field of an existing recipe at any time
- FR5: A user can delete a recipe from their library with a confirmation step
- FR6: A user can save a recipe in an incomplete state — all fields except title remain optional forever
- FR7: The system displays incomplete recipes as intentional — no warning indicators, badges, or draft labels

**Content Discovery**
- FR8: A user can browse recipes from the home screen organized into thematic carousels based on tags
- FR9: Carousels with zero matching recipes are not rendered
- FR10: A user can scroll horizontally through carousel cards
- FR11: A user can open any recipe from a carousel in a single tap with no intermediate screen
- FR12: A user can browse their complete recipe library in a grid view
- FR13: The home screen renders carousels immediately on load without user interaction

**Recipe Capture**
- FR14: The capture form opens with the title field focused and keyboard visible — no additional tap required to start typing
- FR15: The save action is available the moment the title field contains any content
- FR16: After saving, the system displays a brief confirmation and returns to the home screen
- FR17: A newly saved recipe appears in the library immediately after saving

**Recipe Reading**
- FR18: A user can read a recipe in a single continuous scroll — photo hero, ingredients, steps — with no pagination or mode switching
- FR19: The system prevents the screen from dimming or locking while a user views a recipe detail
- FR20: A user can navigate back from a recipe detail view
- FR21: Ingredient and step sections only render when content exists

**Search & Retrieval**
- FR22: A user can search their recipe library from the home screen without navigating away
- FR23: Search results update on every keystroke without a submit action
- FR24: Search matches across title, ingredients, and tags simultaneously
- FR25: The system displays a helpful empty state when a search query returns no results
- FR26: A user can open any recipe directly from search results in a single tap

**Media Management**
- FR27: A user can add a photo to a recipe from their device camera or photo gallery
- FR28: A user can replace or remove an existing recipe photo
- FR29: The system displays a warm visual placeholder for any recipe without a photo — never a broken image state
- FR30: Recipes without photos appear in carousels, library, and search results identically to recipes with photos

**Responsive Experience**
- FR31: A user on mobile experiences a bottom navigation bar for primary app navigation
- FR32: A user on tablet or desktop experiences a side navigation rail and expanded carousel layouts
- FR33: All primary user actions (capture, browse, search, read) are fully accessible on both mobile and tablet/desktop

**System & Security**
- FR34: The system enforces rate limits on all write operations to prevent API abuse
- FR35: A recipe added on one device is immediately accessible on any other device without manual sync
- FR36: All interactive elements meet minimum touch target sizes for mobile usability
- FR37: All content meets WCAG 2.1 Level AA color contrast requirements
- FR38: All primary flows are operable via keyboard navigation on desktop

### NonFunctional Requirements

**Performance**
- NFR-P1: Home screen carousels render within 1.5s on a standard home WiFi connection
- NFR-P2: Recipe detail view loads completely (including image) within 1s of navigation
- NFR-P3: Search results appear within 100ms of each keystroke
- NFR-P4: Recipe save completes within 500ms of tapping Save
- NFR-P5: Skeleton loading states shown only if content load exceeds 150ms (never flashing loaders)
- NFR-P6: Photo uploads proceed asynchronously — recipe is saved and accessible immediately; upload does not block any user action
- NFR-P7: All recipe images delivered in WebP or AVIF format, sized to the requesting device

**Security**
- NFR-S1: All API write endpoints enforce rate limiting
- NFR-S2: All data in transit encrypted via HTTPS
- NFR-S3: All data at rest encrypted
- NFR-S4: Photo storage paths namespaced by session/device token from day one

**Accessibility**
- NFR-A1: All text meets WCAG 2.1 AA contrast ratios (4.5:1 body, 3:1 large text)
- NFR-A2: All interactive elements minimum 44×44px touch target
- NFR-A3: All primary flows operable via keyboard navigation alone
- NFR-A4: HTML declares `lang="fr"`
- NFR-A5: All animations respect `prefers-reduced-motion`
- NFR-A6: `eslint-plugin-jsx-a11y` runs in dev pipeline and blocks builds with violations

**Reliability**
- NFR-R1: Failed saves surface an explicit user-visible error — no silent data loss
- NFR-R2: Photo upload failures surface a user-visible error; the recipe remains saved and accessible
- NFR-R3: A recipe created on one device is readable on any other device within 1s of save completing
- NFR-R4: Wake Lock API failure produces no visible error or broken state — silent fallback only

### Additional Requirements

**From Architecture:**
- Starter template: `create-next-app@latest` with `--typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` + `shadcn@latest init` — must be the first implementation story
- Supabase PostgreSQL with `user_id` UUID nullable FK on recipes table from day one (V2 readiness — no breaking migration when auth lands)
- Database migration file at `supabase/migrations/001_create_recipes.sql` with canonical schema
- Supabase public bucket `recipe-photos` must be created in dashboard
- Photo storage path format: `/{deviceToken}/{recipeId}/photo.webp` enforced in `usePhotoUpload.ts`
- Device token generated via `crypto.randomUUID()` persisted in `localStorage` as `atable_device_token`
- Next.js middleware at `middleware.ts` wraps all `/api/*` routes for rate limiting (best-effort in V1; Upstash Redis upgrade path documented)
- Zod v4 schema in `lib/schemas/recipe.ts` — single schema for both server route handler validation and client form validation
- Separate Supabase clients: `lib/supabase/server.ts` (server components + route handlers) and `lib/supabase/client.ts` (client components only)
- All mutating route handlers (POST, PUT, DELETE) must call `revalidatePath('/')` and `revalidatePath('/recipes/[id]')` before returning
- `next.config.ts` must include Supabase Storage `remotePatterns` for `next/image` (`*.supabase.co`)
- Environment variables configured: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, never exposed to client)
- All French UI strings defined in `src/lib/i18n/fr.ts` — never hardcoded inline in JSX
- DB `snake_case` → TypeScript `camelCase` transformation happens at the data fetching layer only
- Co-located tests: `*.test.ts/tsx` alongside the file under test (no `__tests__/` folders)

**From UX Design:**
- Warm, calm visual palette — off-whites, warm grays, soft cream with single warm olive accent; defined as CSS custom properties in Tailwind config
- Bottom tab navigation (Home / + / Library) on mobile with iOS safe-area insets respected (`env(safe-area-inset-bottom)`)
- Single-scroll reading view design: photo hero → ingredients → steps, large generous typography for kitchen counter distance
- Wake Lock API (`navigator.wakeLock`) with silent graceful fallback for iOS < 16.4
- Full-bleed recipe card imagery with minimal overlay text; warm visual placeholder (never broken image state)
- Empty states feel warm and inviting — invite action, do not instruct or guilt
- Save confirmation toast ("Ajoutée à votre bibliothèque") — brief (2–3s auto-dismiss), non-blocking, no redirect to completion checklist
- Error toasts: persistent until user dismisses
- All animations/transitions must respect `prefers-reduced-motion` (skeleton shimmer, card press, toast slide-in)
- Skeleton loading shown only when load exceeds 150ms — implemented via CSS animation delay, not JS timer
- shadcn/ui components for: form inputs, dialogs, bottom sheets, search input, toast notifications
- Responsive layout: two genuine layout modes (mobile bottom nav + single-column vs tablet/desktop side rail + multi-column), not just reflow

### FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR1 | Epic 2 | Title-only recipe creation |
| FR2 | Epic 2 + 6 | Optional fields: text (E2), photo (E6) |
| FR3 | Epic 2 | View full recipe detail |
| FR4 | Epic 5 | Edit any field at any time |
| FR5 | Epic 5 | Delete with confirmation |
| FR6 | Epic 2 + 5 | Save/edit with title-only; all else optional |
| FR7 | Epic 2 + 5 | No incomplete badges or draft labels |
| FR8 | Epic 3 | Thematic carousels on home screen |
| FR9 | Epic 3 | Empty carousels not rendered |
| FR10 | Epic 3 | Horizontal carousel scroll |
| FR11 | Epic 3 | Single-tap from carousel to recipe |
| FR12 | Epic 3 | Library grid view |
| FR13 | Epic 3 | Home screen carousels render immediately |
| FR14 | Epic 2 | Auto-focused title field on form open |
| FR15 | Epic 2 | Save enabled as soon as title has content |
| FR16 | Epic 2 | Toast confirmation + return to home |
| FR17 | Epic 2 | New recipe appears in library immediately |
| FR18 | Epic 2 | Single-scroll reading view |
| FR19 | Epic 2 | Wake Lock prevents screen dimming |
| FR20 | Epic 2 | Back navigation from recipe detail |
| FR21 | Epic 2 | Conditional rendering of ingredient/step sections |
| FR22 | Epic 4 | Search from home screen without leaving |
| FR23 | Epic 4 | Per-keystroke results, no submit needed |
| FR24 | Epic 4 | Search across title + ingredients + tags |
| FR25 | Epic 4 | Warm empty state for no results |
| FR26 | Epic 4 | Single-tap from search to recipe |
| FR27 | Epic 6 | Add photo from camera or gallery |
| FR28 | Epic 6 | Replace or remove existing photo |
| FR29 | Epic 2 + 3 + 6 | Warm placeholder (E2/3 baseline, E6 full) |
| FR30 | Epic 2 + 3 | Photoless recipes identical in all views |
| FR31 | Epic 1 | Mobile bottom navigation bar |
| FR32 | Epic 1 | Tablet/desktop side navigation rail |
| FR33 | Epics 1–6 | All flows accessible on both layouts |
| FR34 | Epic 1 | Rate limiting middleware |
| FR35 | Epic 2 + 5 | Cross-device sync via revalidatePath |
| FR36 | Epics 1–6 | 44×44px touch targets throughout |
| FR37 | Epic 1 | WCAG AA contrast via design tokens |
| FR38 | Epics 1–6 | Keyboard navigation throughout |

## Epic List

### Epic 1: Project Foundation & Deployable Shell
A live application is deployed to Vercel with the correct tech stack, Supabase database connected, and a responsive navigation shell visible — ready for feature development.
**FRs covered:** FR31, FR32, FR34, FR37

### Epic 2: Core Recipe Loop — Capture, Save & Read
A user can save a recipe in under 30 seconds and immediately read it back in a beautiful, distraction-free view optimized for cooking — with the screen staying on.
**FRs covered:** FR1, FR2 (text fields), FR3, FR6, FR7, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR29 (detail), FR30 (partial), FR35, FR36, FR38

### Epic 3: Discover & Browse — Home Carousels & Library
A user can browse their recipe collection via thematic carousels on the home screen and a full library grid, navigating to any recipe in a single tap.
**FRs covered:** FR8, FR9, FR10, FR11, FR12, FR13, FR29 (cards), FR30 (all views), FR33

### Epic 4: Search — Find Any Recipe Instantly
A user can find any recipe from the home screen by typing — results appear instantly with each keystroke, across title, ingredients, and tags.
**FRs covered:** FR22, FR23, FR24, FR25, FR26

### Epic 5: Recipe Management — Edit, Enrich & Delete
A user can return to any recipe to enrich it with more detail, correct mistakes, or remove it — with all fields remaining optional and no visual penalty for partial state.
**FRs covered:** FR4, FR5, FR6 (edit mode), FR7 (edit mode), FR35

### Epic 6: Photo Experience — Visual Library
A user can add, replace, or remove a photo for any recipe, creating a beautiful visual library — with the recipe always saved and accessible regardless of photo upload status.
**FRs covered:** FR2 (photo), FR27, FR28, FR29 (full), FR30 (full)

---

## Epic 1: Project Foundation & Deployable Shell

A live application is deployed to Vercel with the correct tech stack, Supabase database connected, and a responsive navigation shell visible — ready for feature development.

### Story 1.1: Project Scaffold & Configuration

As a **developer**,
I want the project initialized with create-next-app and shadcn/ui fully configured,
So that the team has a Vercel-optimized foundation with all tooling in place before any feature work begins.

**Acceptance Criteria:**

**Given** the project directory does not exist
**When** `npx create-next-app@latest atable --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` is run followed by `npx shadcn@latest init`
**Then** the project runs at localhost:3000 with no errors
**And** TypeScript compilation succeeds with zero errors
**And** ESLint reports no violations on generated files

**Given** `next.config.ts` is configured
**When** a `next/image` component renders a Supabase storage URL
**Then** the image loads without a domain allowlist error
**And** `remotePatterns` includes `*.supabase.co/storage/v1/object/public/**`

**Given** the project's ESLint config
**When** a JSX accessibility violation is introduced (e.g., an `<img>` without `alt`)
**Then** the build fails with a specific `jsx-a11y` error message

**Given** the repository root
**When** `.env.example` is inspected
**Then** it documents all three required variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) with empty placeholder values
**And** `.env.local` is listed in `.gitignore`

---

### Story 1.2: Supabase Setup & Database Schema

As a **developer**,
I want the Supabase project configured with the recipes table and storage bucket,
So that the application has a production-ready, V2-compatible database from day one with no future breaking migrations.

**Acceptance Criteria:**

**Given** a Supabase project is created and connected
**When** `supabase/migrations/001_create_recipes.sql` is applied
**Then** the `recipes` table exists with columns: `id` (UUID PK, `gen_random_uuid()`), `user_id` (UUID, nullable), `title` (TEXT, NOT NULL), `ingredients` (TEXT, nullable), `steps` (TEXT, nullable), `tags` (TEXT[], default `{}`), `photo_url` (TEXT, nullable), `created_at` (TIMESTAMPTZ, default NOW()), `updated_at` (TIMESTAMPTZ, default NOW())

**Given** the Supabase dashboard
**When** the storage section is inspected
**Then** a public bucket named `recipe-photos` exists
**And** the bucket allows public read access to objects

**Given** the environment variables are configured in `.env.local`
**When** a test connection to Supabase is made from the server client
**Then** a query to `recipes` returns an empty array (not an error)
**And** `SUPABASE_SERVICE_ROLE_KEY` is not referenced anywhere in `src/` client-side code

---

### Story 1.3: Core Libraries & Type Definitions

As a **developer**,
I want the Zod schema, Supabase clients, French i18n strings, and TypeScript types established,
So that all subsequent stories build on a consistent, typed, single-source-of-truth foundation.

**Acceptance Criteria:**

**Given** `src/lib/schemas/recipe.ts` is created
**When** `RecipeCreateSchema` is used to validate `{ title: "Poulet rôti" }`
**Then** validation succeeds
**When** it validates `{ title: "" }` or `{}`
**Then** validation fails with a descriptive error on the title field
**And** all other fields (ingredients, steps, tags, photo_url) are optional with no validation errors when absent

**Given** `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts`
**When** a server component imports from `server.ts`
**Then** the Supabase service role key is accessible
**And** no `'use client'` directive is present in `server.ts`
**When** a client component imports from `client.ts`
**Then** only the anon key is used (safe for browser exposure)

**Given** `src/lib/i18n/fr.ts`
**When** any component needs a user-visible string
**Then** the string is imported from `fr.ts` using the typed `t` object (never hardcoded in JSX)
**And** `fr.ts` contains at minimum: app name, navigation labels (Accueil, Ajouter, Bibliothèque), action labels (Enregistrer, Annuler, Supprimer), save confirmation message

**Given** `src/types/recipe.ts`
**When** the `Recipe` type is inspected
**Then** all field names are camelCase (`createdAt`, `photoUrl`, `updatedAt`)
**And** a mapping from Supabase snake_case (`created_at`) to TypeScript camelCase occurs in the data fetching layer, not in components

---

### Story 1.4: App Shell & Responsive Navigation

As a **user on mobile or tablet/desktop**,
I want a consistent navigation shell that adapts to my screen size,
So that I can always orient myself and switch between the main app sections.

**Acceptance Criteria:**

**Given** the app is loaded on a screen narrower than 1024px
**When** any page is viewed
**Then** a bottom navigation bar is visible with three items: Accueil (Home), + (Add), Bibliothèque (Library)
**And** the active route item is visually highlighted
**And** the nav bar uses `env(safe-area-inset-bottom)` to respect iOS notch/home indicator
**And** each nav item has a minimum touch target of 44×44px

**Given** the app is loaded on a screen 1024px or wider
**When** any page is viewed
**Then** a side navigation rail is visible with the same three items
**And** the bottom navigation bar is hidden
**And** the main content area adjusts its left margin to account for the rail width

**Given** the root layout (`src/app/layout.tsx`)
**When** any page renders
**Then** the `<html>` element has `lang="fr"`
**And** a `Toaster` component from shadcn/ui is mounted at the root level
**And** the page title reflects the app name

**Given** the `DeviceTokenProvider` client component mounts
**When** it is the first ever load on this device
**Then** `crypto.randomUUID()` generates a UUID stored in `localStorage` as `atable_device_token`
**When** the page is reloaded or navigated
**Then** the existing token is reused (no new UUID generated)

**Given** `error.tsx` and `not-found.tsx` exist
**When** an unhandled error or 404 occurs
**Then** a graceful error page renders within the navigation shell (not a raw browser error)

---

### Story 1.5: Vercel Deployment & Rate Limiting Middleware

As a **developer**,
I want the app live on Vercel with middleware protecting all API routes from day one,
So that the application is accessible cross-device and abuse-resistant before any real data exists.

**Acceptance Criteria:**

**Given** the repository is connected to Vercel
**When** code is pushed to `main`
**Then** a production deployment completes successfully with no build errors
**And** the app is accessible at the Vercel production URL
**And** `eslint-plugin-jsx-a11y` runs during the Vercel build (fails deploy on violations)

**Given** a feature branch pull request is opened
**When** code is pushed to the branch
**Then** Vercel creates a preview deployment automatically
**And** the preview URL is posted to the pull request

**Given** `middleware.ts` at the project root
**When** any request hits `/api/*`
**Then** the middleware intercepts it before reaching the route handler
**When** the request method is POST, PUT, PATCH, or DELETE
**Then** rate-limit response headers are included in the response
**When** the rate limit threshold is exceeded from a single source
**Then** a `429 Too Many Requests` response is returned

**Given** the production Vercel environment
**When** the client-side bundle is inspected
**Then** `SUPABASE_SERVICE_ROLE_KEY` is not present in any client-accessible JavaScript

---

## Epic 2: Core Recipe Loop — Capture, Save & Read

A user can save a recipe in under 30 seconds and immediately read it back in a beautiful, distraction-free view optimized for cooking — with the screen staying on.

### Story 2.1: Recipe Create & Retrieve API

As a **developer**,
I want `POST /api/recipes` and `GET /api/recipes/[id]` route handlers in place,
So that recipe data can be created and retrieved with full Zod validation, error handling, and cross-device sync.

**Acceptance Criteria:**

**Given** a `POST /api/recipes` request with body `{ "title": "Poulet rôti" }`
**When** the route handler processes it
**Then** a new recipe row is inserted into Supabase with the provided title
**And** all other fields (ingredients, steps, tags, photo_url, user_id) default to null/empty
**And** the response returns the created recipe as JSON with HTTP 201
**And** `revalidatePath('/')` and `revalidatePath('/recipes/[id]')` are called before returning

**Given** a `POST /api/recipes` request with body `{ "title": "" }` or `{}`
**When** the route handler validates with Zod
**Then** a `422` response is returned with body `{ "error": "..." }` describing the title requirement
**And** no database insert occurs

**Given** a `GET /api/recipes/[id]` request with a valid UUID
**When** the recipe exists in the database
**Then** the response returns the full recipe as JSON with HTTP 200
**And** all field names in the response are camelCase (`createdAt`, `photoUrl`, `updatedAt`)

**Given** a `GET /api/recipes/[id]` request with a non-existent UUID
**When** no matching row is found
**Then** a `404` response is returned with body `{ "error": "Recipe not found" }`

**Given** any unhandled server error in a route handler
**When** the error is caught
**Then** a `500` response is returned with body `{ "error": "..." }` (never an unhandled exception to the client)

---

### Story 2.2: Recipe Capture Form

As a **household curator**,
I want to open a capture form, type a recipe title, and save it in under 30 seconds,
So that I can record a recipe in the moment without losing track of what I'm doing.

**Acceptance Criteria:**

**Given** the user taps the "+" navigation item
**When** the `/recipes/new` page loads
**Then** the title input field is focused and the keyboard is visible — no additional tap required
**And** the Save button is disabled (or visually inactive)

**Given** the title field contains at least one character
**When** the user is on the capture form
**Then** the Save button becomes active and tappable
**And** all other fields (ingredients, steps, tags) are optional and show no validation errors when empty

**Given** the user taps Save with a valid title
**When** the `POST /api/recipes` call completes within 500ms
**Then** a toast notification appears with the French confirmation message ("Ajoutée à votre bibliothèque")
**And** the toast auto-dismisses after 2–3 seconds without user action
**And** the user is returned to the home screen
**And** no redirect to a completion checklist or "finish your recipe" prompt occurs

**Given** the Save call fails (network error or server error)
**When** the error is caught
**Then** a persistent error toast appears (does not auto-dismiss) with a French error message
**And** the form remains open with the user's content intact so they can retry

**Given** the user is on the capture form on a mobile device
**When** the form is displayed
**Then** all interactive elements (Save button, form fields, back button) have a minimum touch target of 44×44px

**Given** `prefers-reduced-motion` is enabled on the user's device
**When** the toast notification appears
**Then** it renders without slide-in animation

---

### Story 2.3: Recipe Detail Reading View

As a **household curator**,
I want to read a saved recipe in a single distraction-free scroll with the screen staying on,
So that I can cook from my phone without losing my place or fighting the screen timeout.

**Acceptance Criteria:**

**Given** a recipe detail page (`/recipes/[id]`) is loaded
**When** the page renders
**Then** the content flows as a single continuous vertical scroll: photo hero (or warm placeholder) → ingredients section → steps section — no pagination or mode switch required

**Given** a recipe has no photo
**When** the detail page renders
**Then** a warm visual placeholder fills the hero area
**And** the placeholder never shows a broken image icon or alt-text error state

**Given** a recipe has no ingredients
**When** the detail page renders
**Then** the ingredients section is not rendered (not an empty section header)
**And** the same applies to the steps section

**Given** the user opens a recipe detail page
**When** the `useWakeLock` hook activates
**Then** `navigator.wakeLock.request('screen')` is called to prevent screen dimming
**And** the wake lock is released when the user navigates away from the page

**Given** the browser does not support the Wake Lock API (e.g., iOS < 16.4)
**When** `navigator.wakeLock` is unavailable
**Then** no error is shown to the user
**And** the page renders and functions normally — the screen may dim but no broken state occurs

**Given** the recipe detail page loads
**When** measured on a standard home WiFi connection
**Then** the page including the recipe image loads completely within 1 second of navigation
**And** if the image takes longer than 150ms, a skeleton placeholder is shown using CSS animation delay (not a JS timer)

**Given** the user taps the back button or swipe gesture
**When** navigating away from the recipe detail
**Then** the user is returned to the previous screen (home or library)
**And** the wake lock is released

**Given** a recipe detail page on a desktop browser
**When** the user presses Tab to navigate
**Then** focus moves logically through interactive elements (back button, edit link)
**And** all focusable elements have a visible focus ring

---

## Epic 3: Discover & Browse — Home Carousels & Library

A user can browse their recipe collection via thematic carousels on the home screen and a full library grid, navigating to any recipe in a single tap.

### Story 3.1: Recipe List API

As a **developer**,
I want a `GET /api/recipes` route handler that returns all recipes,
So that the home screen and library grid have the data they need to render.

**Acceptance Criteria:**

**Given** a `GET /api/recipes` request
**When** recipes exist in the database
**Then** the response returns an array of all recipes as JSON with HTTP 200
**And** each recipe includes at minimum: `id`, `title`, `tags`, `photoUrl`, `createdAt`
**And** all field names are camelCase
**And** recipes are ordered by `createdAt` descending (newest first)

**Given** a `GET /api/recipes` request
**When** no recipes exist
**Then** the response returns an empty array `[]` with HTTP 200 (not a 404)

**Given** any unhandled server error
**When** the error is caught
**Then** a `500` response is returned with body `{ "error": "..." }`

---

### Story 3.2: Home Screen Carousels

As a **household curator**,
I want to open the app and immediately see my recipes organized into thematic carousels,
So that I can browse by mood and find the right recipe for the moment with a single tap.

**Acceptance Criteria:**

**Given** the home screen loads
**When** any recipes exist with matching tags
**Then** thematic carousels render immediately on load without any user interaction
**And** each carousel has a title label matching its tag theme
**And** recipes scroll horizontally within each carousel

**Given** a tag has zero matching recipes
**When** the home screen renders
**Then** that carousel is not rendered at all — no empty section header appears

**Given** a carousel card is tapped
**When** the user selects a recipe
**Then** the full recipe detail page opens directly with no intermediate screen

**Given** a recipe in a carousel has no photo
**When** the carousel card renders
**Then** a warm visual placeholder appears in the card image area
**And** the card is visually indistinguishable in layout from a card with a photo

**Given** the home screen on a screen narrower than 1024px
**When** carousels render
**Then** cards are horizontally scrollable in a single row
**When** the screen is 1024px or wider
**Then** carousels show wider cards with more cards visible without scrolling

**Given** home screen data takes longer than 150ms to load
**When** the skeleton threshold is crossed
**Then** skeleton placeholder cards appear via CSS animation delay (not a JS timer)
**When** the load completes under 150ms
**Then** no skeleton is shown — content appears directly

**Given** a standard home WiFi connection
**When** the home screen is opened
**Then** carousels render within 1.5 seconds

---

### Story 3.3: Library Grid View

As a **household curator**,
I want to browse my complete recipe collection in a grid layout,
So that I can see everything I've saved and navigate to any recipe directly.

**Acceptance Criteria:**

**Given** the user navigates to the Library page
**When** recipes exist
**Then** all recipes are displayed in a grid
**And** on mobile the grid shows 2 columns; on tablet/desktop it shows 3 or more columns
**And** each card shows the recipe photo (or warm placeholder) and title

**Given** a recipe card in the grid is tapped
**When** the user selects it
**Then** the full recipe detail page opens with no intermediate screen

**Given** no recipes have been saved yet
**When** the library page renders
**Then** a warm, inviting empty state is displayed with a CTA linking to the capture form
**And** no error state, broken layout, or blank screen appears

**Given** the library grid load exceeds 150ms
**When** the skeleton threshold is crossed
**Then** skeleton placeholder cards are shown
**When** the load completes under 150ms
**Then** content appears directly without a skeleton flash

**Given** a recipe without a photo in the grid
**When** the card renders
**Then** it occupies the same grid cell size as a recipe with a photo
**And** the warm placeholder fills the image area consistently

---

## Epic 4: Search — Find Any Recipe Instantly

A user can find any recipe from the home screen by typing — results appear instantly with each keystroke, across title, ingredients, and tags.

### Story 4.1: Recipe Search Hook & Logic

As a **developer**,
I want a `useRecipeSearch` hook that filters the in-memory recipe list on every keystroke,
So that search results are available within 100ms with no additional network requests.

**Acceptance Criteria:**

**Given** `src/hooks/useRecipeSearch.ts` is created
**When** the hook receives a list of recipes and a query string
**Then** it returns the filtered subset where the query matches title, any ingredient text, or any tag (case-insensitive)

**Given** the query string is empty
**When** the hook evaluates the filter
**Then** it returns the full unfiltered recipe list

**Given** a library of up to 500 recipes
**When** the filter runs on a keystroke
**Then** the filtered result is available within 100ms with no debounce needed

**Given** `useRecipeSearch.test.ts` co-located with the hook
**When** tests run
**Then** they cover: empty query returns all, title match, ingredient match, tag match, case-insensitive match, no match returns empty array

---

### Story 4.2: Search UI & Empty State

As a **household curator**,
I want a persistent search bar on the home screen that shows results as I type,
So that I can find any recipe by name, ingredient, or tag without navigating away.

**Acceptance Criteria:**

**Given** the user is on the home screen
**When** the page loads
**Then** a search bar is visible without any scrolling or additional tap required

**Given** the user types in the search bar
**When** each character is entered
**Then** results update immediately — no submit action, no delay
**And** matching recipes are displayed below the search bar
**And** each result is tappable and opens the recipe detail directly

**Given** the user types a query that matches no recipes
**When** the results list renders
**Then** a warm, inviting empty state is displayed in French (not a red error or blank screen)

**Given** the user clears the search bar
**When** the query becomes empty
**Then** the carousels return to view and the results list is dismissed

**Given** `prefers-reduced-motion` is enabled
**When** results appear
**Then** no motion transitions are applied to the results list

---

## Epic 5: Recipe Management — Edit, Enrich & Delete

A user can return to any recipe to enrich it with more detail, correct mistakes, or remove it — with all fields remaining optional and no visual penalty for partial state.

### Story 5.1: Recipe Update & Delete API

As a **developer**,
I want `PUT /api/recipes/[id]` and `DELETE /api/recipes/[id]` route handlers in place,
So that recipe updates and deletions are validated, persisted, and reflected across all devices immediately.

**Acceptance Criteria:**

**Given** a `PUT /api/recipes/[id]` request with a valid body
**When** the route handler processes it
**Then** the matching recipe row is updated in Supabase with the new values
**And** `updated_at` is set to the current timestamp
**And** the response returns the updated recipe as JSON with HTTP 200
**And** `revalidatePath('/')` and `revalidatePath('/recipes/[id]')` are called before returning

**Given** a `PUT /api/recipes/[id]` request with `{ "title": "" }`
**When** Zod validates the body
**Then** a `422` response is returned with body `{ "error": "..." }`
**And** no database update occurs

**Given** a `DELETE /api/recipes/[id]` request with a valid UUID
**When** the recipe exists
**Then** the recipe row is deleted from Supabase
**And** the response returns HTTP 204 with no body
**And** `revalidatePath('/')` is called before returning

**Given** a `PUT` or `DELETE` request with a UUID that does not exist
**When** no matching row is found
**Then** a `404` response is returned with body `{ "error": "Recipe not found" }`

---

### Story 5.2: Edit Recipe Form

As a **household curator**,
I want to open any recipe for editing with all existing content pre-filled,
So that I can enrich incomplete recipes or correct mistakes without re-entering everything.

**Acceptance Criteria:**

**Given** the user taps the Edit action on a recipe detail page
**When** the `/recipes/[id]/edit` page loads
**Then** the `RecipeForm` renders pre-filled with all existing recipe data (title, ingredients, steps, tags)
**And** all fields except title remain optional — no validation errors appear on empty optional fields

**Given** the user modifies fields and taps Save
**When** the `PUT /api/recipes/[id]` call completes
**Then** a success toast appears in French and auto-dismisses after 2–3 seconds
**And** the user is returned to the recipe detail page
**And** the detail page immediately reflects the updated content (via revalidatePath)

**Given** the user edits a recipe that previously had no ingredients or steps
**When** they add content and save
**Then** the detail page now renders those sections
**And** no visual "previously incomplete" indicator appears anywhere

**Given** the PUT call fails
**When** the error is caught
**Then** a persistent error toast appears with a French error message
**And** the form remains open with the user's edits intact

**Given** the edit form on mobile
**When** rendered
**Then** all interactive elements meet the 44×44px minimum touch target

---

### Story 5.3: Delete Recipe with Confirmation

As a **household curator**,
I want to delete a recipe with a confirmation step,
So that I can remove entries intentionally without risking accidental data loss.

**Acceptance Criteria:**

**Given** the user taps the Delete action on a recipe detail or edit page
**When** the action is triggered
**Then** a `ConfirmDeleteDialog` (shadcn/ui Dialog) appears asking the user to confirm in French
**And** the dialog presents two options: confirm delete and cancel

**Given** the user confirms deletion
**When** the `DELETE /api/recipes/[id]` call completes
**Then** the dialog closes and the user is navigated to the home screen
**And** the deleted recipe no longer appears in carousels, library, or search results

**Given** the user cancels in the dialog
**When** cancel is tapped
**Then** the dialog closes, the recipe is unchanged, and the user remains on the same page

**Given** the DELETE call fails
**When** the error is caught
**Then** the dialog closes and a persistent error toast appears in French
**And** the recipe remains in the library

**Given** the confirmation dialog on mobile
**When** it renders
**Then** both the confirm and cancel buttons meet 44×44px minimum touch target

---

## Epic 6: Photo Experience — Visual Library

A user can add, replace, or remove a photo for any recipe, creating a beautiful visual library — with the recipe always saved and accessible regardless of photo upload status.

### Story 6.1: Photo Upload Infrastructure

As a **developer**,
I want the `useDeviceToken` and `usePhotoUpload` hooks in place with the correct Supabase storage path structure,
So that all photo uploads are namespaced from day one, enabling V2 per-user access control without any storage migration.

**Acceptance Criteria:**

**Given** `src/hooks/useDeviceToken.ts` is created
**When** the hook is called
**Then** it reads `atable_device_token` from `localStorage` and returns the UUID
**And** if no token exists, it generates one via `crypto.randomUUID()`, persists it, and returns it

**Given** `src/hooks/usePhotoUpload.ts` is created
**When** `uploadPhoto(file, recipeId)` is called
**Then** the file is uploaded to Supabase Storage at path `recipe-photos/{deviceToken}/{recipeId}/photo.webp`
**And** the upload uses `lib/supabase/client.ts` exclusively (never the server client)
**And** on success, the function returns the public URL of the uploaded file

**Given** the upload succeeds
**When** `photo_url` is updated on the recipe row and `revalidatePath('/recipes/[id]')` is called
**Then** the detail page reflects the new photo on next load

**Given** the upload fails (network or storage error)
**When** the error is caught
**Then** the hook returns an error state (does not throw)
**And** the recipe record remains accessible and unchanged

**Given** `usePhotoUpload.test.ts` co-located with the hook
**When** tests run
**Then** they cover: successful upload returns URL, upload failure returns error state, storage path format is correct

---

### Story 6.2: Add Photo on Recipe Capture & Detail

As a **household curator**,
I want to add a photo to a recipe from my camera or gallery — at capture time or later,
So that my library becomes visually rich without a photo ever being required to save.

**Acceptance Criteria:**

**Given** the user is on the capture form
**When** they tap the photo area
**Then** the device's native camera/gallery picker opens (standard iOS bottom sheet — no custom implementation)

**Given** the user selects a photo and then taps Save
**When** the save flow executes
**Then** the recipe text data is saved to the database first — the save does not wait for photo upload
**And** the success toast and home screen redirect happen immediately after the recipe row is created
**And** the photo upload begins asynchronously in the background after the recipe ID is returned

**Given** the background photo upload completes successfully
**When** the user navigates to the recipe detail
**Then** the uploaded photo is visible in the hero area served via `next/image` in WebP/AVIF

**Given** the background photo upload fails
**When** the error is detected
**Then** a dismissible error toast appears in French (e.g., "La photo n'a pas pu être ajoutée")
**And** the recipe remains saved and fully accessible without the photo

**Given** `next/image` renders an uploaded photo
**When** the image loads
**Then** a blur placeholder is shown while loading with no layout shift

---

### Story 6.3: Replace & Remove Photo via Edit

As a **household curator**,
I want to replace or remove a recipe's photo when editing,
So that I can improve my library's visual quality over time as better photos become available.

**Acceptance Criteria:**

**Given** the user opens the edit form for a recipe that has a photo
**When** the form renders
**Then** the existing photo is displayed as a thumbnail in the photo field
**And** two options are available: replace photo and remove photo

**Given** the user taps "Replace photo" and selects a new image
**When** the edit form is saved
**Then** the new photo is uploaded to the same namespaced path (`recipe-photos/{deviceToken}/{recipeId}/photo.webp`), overwriting the previous file
**And** `photo_url` is updated in the database
**And** `revalidatePath('/recipes/[id]')` is called after the update

**Given** the user taps "Remove photo" and saves
**When** the PUT call completes
**Then** `photo_url` is set to null in the database
**And** the recipe detail now shows the warm placeholder instead of a photo
**And** the recipe continues to appear normally in carousels, library, and search

**Given** the photo replacement upload fails
**When** the error is caught
**Then** a persistent error toast appears in French
**And** the recipe retains its previous photo — no partial state

**Given** a recipe without a photo on the edit form
**When** the form renders
**Then** the photo area shows the warm placeholder and only an "Add photo" option (no remove option)
