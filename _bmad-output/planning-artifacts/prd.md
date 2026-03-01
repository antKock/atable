---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-atable-2026-02-28.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
briefCount: 1
researchCount: 0
brainstormingCount: 0
projectDocsCount: 0
workflowType: 'prd'
classification:
  projectType: web_app
  domain: general
  complexity: low
  projectContext: greenfield
---

# Product Requirements Document - atable

**Author:** Anthony
**Date:** 2026-03-01

## Executive Summary

atable is a photo-first personal recipe vault for intentional home cooks who want to own their culinary collection — not be managed by it. Recipes currently live scattered across phone notes, screenshots, bookmarks, and memory. atable consolidates them into one browsable, beautiful library that reflects the user's taste, not a platform's algorithm.

The product is built around two equally essential moments: **capture** (saving a recipe in under 60 seconds immediately after a great meal) and **retrieve** (browsing thematic carousels on Sunday to plan the week). Both create the habit loop that makes the library grow and earn daily trust.

**Target users:**
- **Primary — Household Curators:** A couple in their 30s who cook intentionally and do a weekly meal-planning ritual. Their collection is currently fragmented; they need one beautiful, browsable place for *their* recipes.
- **Secondary — The Dinner Guest:** A friend or family member who receives a shared recipe link, views it without an account, and occasionally converts to their own library (V2+).

**Problem:** Existing recipe apps solve the wrong problem — they surface their own catalogs and force metadata entry at save time. atable solves the real problem: remembering and retrieving the recipes *you* already chose.

### What Makes This Special

| Differentiator | What it means |
|---|---|
| **Pure curation** | No algorithmic suggestions — only recipes you added. The library is a mirror of your culinary identity. |
| **Zero-friction capture** | Title is the only required field. A recipe can be saved in under 30 seconds; everything else is optional and can be added later. |
| **Browse-by-mood discovery** | Thematic carousels introduce a new mental model: browse your *own* collection by mood, not just search by name. |
| **Photo-resilient design** | Beautiful with a great photo; graceful with a mediocre one; intentional-looking with no photo at all. |
| **Incomplete ≠ broken** | Partial recipes are first-class citizens — no badges, no guilt, no draft states. Completion happens on the user's terms. |

**Core insight:** Recipe apps want to be platforms. atable is a vault. The distinction is everything.

## Project Classification

| Dimension | Value |
|---|---|
| **Project Type** | Web App — responsive, Next.js SPA hosted on Vercel |
| **Domain** | General (consumer lifestyle / personal productivity) |
| **Complexity** | Low — standard CRUD, UX-focused, no regulated domain |
| **Project Context** | Greenfield — new product, no existing system |

## Success Criteria

### User Success

atable succeeds when it earns a place in daily life without requiring maintenance or discipline. Success is behavioral, not numerical.

| Signal | What it looks like |
|---|---|
| **Reflexive weekly opens** | App is opened on Sunday for planning and on weeknights for cooking without consciously remembering to |
| **Proactive capture** | After a great meal, the instinct is to add it to atable — not screenshot it |
| **Screenshots folder stops growing** | The previous fragmented system is genuinely replaced |
| **Carousels feel meaningful** | Home screen reflects actual cooking moods; browsing by tag surfaces the right recipes |
| **Recipe retrieval in seconds** | Finding a known recipe requires no cross-app hunting — search or a single carousel scroll |

**Critical success moments:**
- First time a recipe is saved instead of screenshotted
- First Sunday where the whole week is planned from one place
- First time a recipe is cooked using the app without losing your place

### Business Success

atable is a household product, not a commercial one. Business success = sustained household adoption.

**V1 success gate:** Both household members use atable as their primary recipe store through at least **4–6 consecutive weeks** of real cooking. V2 does not begin until V1 earns this.

### Technical Success

**Cross-device reliability is the primary technical requirement.** The same library, the same recipes, the same experience — whether on iPhone in the kitchen or iPad on Sunday morning. Precise measurable targets are defined in Non-Functional Requirements.

### Measurable Outcomes

| Outcome | V1 threshold |
|---|---|
| Capture flow completion | Recipe saved with title only in under 30 seconds |
| Browse-to-recipe | Full recipe reachable in exactly 2 taps from home screen |
| Cross-device sync | Zero discrepancies between phone and tablet library |
| Form validation | Zero false-positive required-field errors on optional fields |

### Failure Signals (V1 scope)

- Recipes stop being entered after the first month → capture friction is too high
- App is opened for lookup only, never for browsing → carousel/discovery experience failed
- Home screen carousels feel empty or irrelevant → manual tagging workflow is broken or confusing
- Recipes load slowly on tablet during Sunday planning → performance or image delivery issue
- Recipe detail is uncomfortable to read from counter distance → typography or layout problem

## Product Scope & Roadmap

### MVP Strategy

**MVP Approach:** Experience MVP — the goal is earned daily trust through superior UX, not hypothesis validation or revenue generation. The product is "complete" when both household members open it reflexively and their screenshots folder stops growing.

**Solo developer scope:** V1 is intentionally bounded to standard CRUD, responsive web, Supabase + Vercel infrastructure. No novel architecture.

### MVP Feature Set — V1

| Capability | Why it's essential |
|---|---|
| Recipe CRUD | Without this, there is no product |
| Title-only capture (30s) | Without this, the habit loop never forms |
| Home screen carousels (manual tags) | Without this, there's no discovery — just lookup |
| Library grid view | Without this, users can't browse their full collection |
| Instant search (title, ingredients, tags) | Without this, known-item retrieval fails |
| Photo upload + warm placeholder | Without this, the visual identity breaks |
| Recipe reading view (Wake Lock, large type) | Without this, cooking use case fails |
| Responsive layout (mobile + lg breakpoint) | Without this, Sunday iPad planning doesn't work |
| Vercel + Supabase deployment | Without this, cross-device sync doesn't exist |
| API rate limiting | Without this, the app is abusable from launch |
| French language | Household requirement |

**Explicitly excluded from V1:** Authentication, public sharing, AI enrichment, offline mode, OCR import.

### V2 — Post-MVP (after V1 success gate is met)

| Feature | Architectural implication |
|---|---|
| **Authentication** | User accounts, sessions — database schema must support multi-user from day one |
| **Public recipe sharing** | Public read-only URLs — content must be shareable without exposing private data |
| **AI async enrichment** | Background job queue for tag/duration/calorie generation — backend must support async workers |

### V3+ — Vision

| Feature | Notes |
|---|---|
| OCR / cookbook photo import | Image-to-recipe parsing |
| Auto prep time, difficulty, calories | AI-generated recipe metadata |
| Full AI auto-tagging | Zero categorization effort |
| Household accounts with shared pool | Multi-user shared library |
| AI photo generation | Auto-source or generate recipe images |

### Risk Mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Manual tagging too low → empty carousels | Medium | Accepted V1 risk; AI enrichment in V2 is the fix |
| Wake Lock fails on older iOS | Low | Silent graceful fallback — screen dims, experience continues |
| Photo upload fails silently | Low | Optimistic UI — recipe saves first; async upload with explicit error on failure |
| Scope creep (auth, AI pulled into V1) | Medium | Hard V1 boundary enforced by success gate |
| Solo developer capacity | Low | Standard CRUD + Supabase/Vercel — no novel architecture |

## User Journeys

### Journey 1 — Browse & Cook (Primary Happy Path)

**Persona: Anthony, Household Curator**
*Tuesday, 6:45pm. Anthony is standing in the kitchen, hunger starting to win.*

**Opening scene:** The old reflex would have been to open Notes, dig through screenshots, maybe text Alice. Instead, he opens atable. The home screen loads immediately — thematic carousels, photos he recognizes, meals he chose. No noise.

**Rising action:** His eye catches the "Comfort food" carousel. He scrolls two cards — there it is, the roasted chicken they made last month. One tap. The full recipe opens: hero photo, ingredients, numbered steps. No intermediate screen, no loading.

**Climax:** He props the phone against the salt cellar and starts cooking. The screen stays on. He scrolls through the steps with a flour-covered finger. The app disappears — there's only the recipe.

**Resolution:** Dinner is made. The whole interaction — from opening the app to reading step 3 — was under two minutes. This is what replacing the screenshot folder feels like.

**Requirements revealed:** Instant home screen load, 2-tap browse-to-recipe, Wake Lock, large readable typography, single-scroll recipe view, graceful back navigation.

---

### Journey 2 — In-the-Moment Capture (Primary Happy Path)

**Persona: Alice, Household Curator**
*Saturday night. They've just finished an incredible meal at a friend's place — a slow-cooked lamb with preserved lemon.*

**Opening scene:** At the table, dessert being passed around. She opens atable, taps the "+" — the form appears. The title field is already focused, keyboard up.

**Rising action:** She types "Agneau confit citron confit" — 4 seconds. She adds rough ingredients from memory: lamb shoulder, preserved lemons, harissa, honey. She taps Save. That's it.

**Climax:** A warm toast appears — "Ajoutée à votre bibliothèque" — and vanishes. She's back on the home screen. 40 seconds total. She didn't miss a moment of the evening.

**Resolution:** Three weeks later, Anthony sees it in the library during Sunday planning. Photo-less, step-less, but there. Completable whenever. Not broken.

**Requirements revealed:** Auto-focused title field on form open, save always active with title only, warm non-intrusive confirmation toast, recipe appears in library immediately, no redirect to completion checklist.

---

### Journey 3 — Recipe Enrichment (Edge Case / Return Flow)

**Persona: Anthony, Household Curator**
*The following Tuesday. Anthony taps the lamb recipe to cook it — title and rough ingredients only. No steps. No photo.*

**Opening scene:** Recipe detail: title, a few ingredient lines, nothing else. Not alarming — just incomplete. No warning badge, no draft label. The edit button is quiet.

**Rising action:** He taps Edit. The form opens pre-filled. He adds four steps from memory, finds a photo from his camera roll. Taps Save.

**Climax:** The recipe detail now shows the full hero photo, ingredients, steps. Not because the app forced him — because he wanted to.

**Resolution:** Next Sunday, the lamb appears in the carousel with its photo. Alice spots it. "We should make that again."

**Requirements revealed:** Edit form pre-filled with existing data, no visual penalty for incomplete state, all fields remain optional in edit mode, photo addition from gallery, recipe detail updates immediately post-save.

---

### Journey 4 — Search (Alternative Path)

**Persona: Alice, Household Curator**
*Thursday morning. Alice wants the pasta with brown butter and sage — she knows exactly what she wants.*

**Opening scene:** Home screen. She taps the search bar — keyboard up. She types "beurre noisette." Results appear before she finishes the word.

**Rising action:** Two recipes match. She recognizes the right one. One tap.

**Climax:** Full recipe in under 20 seconds. Search isn't the primary experience — browsing is. But when you know what you want, it gets out of your way.

**Requirements revealed:** Persistent search bar on home screen, instant results on every keystroke, search across title + ingredients + tags simultaneously, warm empty state when no results.

---

### Journey 5 — The Dinner Guest (Secondary User)

**Persona: Marie, friend of Anthony & Alice**
*The morning after dinner. She texts Anthony: "Can you send me the recipe?"*

**Opening scene:** Anthony taps Share and sends a WhatsApp link. Marie opens it on her iPhone — no app prompt, no account wall.

**Rising action:** The recipe opens in her browser: full-bleed photo, ingredients, steps. Clean. She screenshots the ingredient list.

**Climax:** A quiet prompt at the bottom: "Save this to your own atable." She taps it. *(V2+ flow.)*

**Resolution (V1):** She has the recipe, readable, no account required. The architecture supports conversion; V1 doesn't require it.

**Requirements revealed (V1):** Public read-only recipe URL without authentication, mobile-optimized shared view. *(V2: account creation CTA, recipe import.)*

---

### Journey → FR Traceability

| Capability | Journey(s) | FR(s) |
|---|---|---|
| Instant home screen load with carousels | J1, J4 | FR8, FR13 |
| 2-tap browse-to-recipe | J1 | FR11 |
| Wake Lock during cooking | J1 | FR19 |
| Single-scroll reading view, large typography | J1, J3 | FR18, FR21 |
| Auto-focused capture form, title-only save | J2 | FR14, FR15 |
| Immediate library appearance post-save | J2, J3 | FR17 |
| Toast confirmation, no checklist redirect | J2 | FR16 |
| Edit form pre-filled, all fields optional | J3 | FR4, FR6 |
| Photo addition from gallery | J3 | FR27 |
| Persistent search bar, instant results | J4 | FR22, FR23 |
| Search across title + ingredients + tags | J4 | FR24 |
| Public read-only shared URL (V2) | J5 | — |

## Web App Specific Requirements

### Browser Matrix

| Priority | Target | Use Case |
|---|---|---|
| **Critical** | iOS Safari (iPhone) | Primary capture and cooking surface |
| **Critical** | iOS Safari (iPad landscape) | Sunday planning session |
| **High** | Chrome (mobile simulation) | Development and testing |
| **Medium** | Safari (macOS) | Occasional desktop use |
| **Medium** | Chrome (macOS) | Occasional desktop use |
| **Not targeted** | Firefox, Edge, older Android | Out of scope for V1 |

**Key iOS Safari constraints:**
- Wake Lock API (`navigator.wakeLock`) — iOS 16.4+; silent graceful fallback required for older versions
- Web Share API — V2 recipe sharing; plan architecturally in V1
- Safe area insets — bottom nav must respect `env(safe-area-inset-bottom)` on notched devices
- No custom install prompt — PWA install is browser-initiated on iOS

### Responsive Design

Mobile-first with one meaningful breakpoint at `lg` (1024px) — two genuine layout modes, not just reflow.

| Breakpoint | Range | Layout |
|---|---|---|
| Default | 0–767px | Single column, bottom nav bar, full-bleed cards |
| `md` | 768–1023px | Minor card sizing refinement only |
| `lg` | 1024px+ | Side nav rail, wider carousels, 3-column library grid |

**Layout principles:** `max-w-*` with `mx-auto` on all containers; relative units (rem, %, fr) throughout; 8px base spacing unit; `next/image` for all photos (WebP/AVIF, lazy load, blur placeholder, no layout shift).

### SEO Strategy

**V1: Out of scope.** Private personal vault — no public pages, no indexable content. Search visibility would expose private recipe data.

**V2+:** Public recipe sharing pages require Open Graph tags, `schema.org/Recipe` structured data, and social preview images. V1 architecture must not actively prevent this.

### Implementation Considerations

**Tech stack:**
- Framework: Next.js (App Router)
- Styling: Tailwind CSS + shadcn/ui
- Database/Storage: Supabase (PostgreSQL + object storage)
- Deployment: Vercel
- Language: French UI (`lang="fr"`)

**V2 readiness (architectural requirements enforced in V1):**
- `user_id` foreign key on recipes table from day one — no breaking migration when auth lands
- Photo storage paths namespaced by session/device token — enables per-user access control in V2
- API routes designed for future auth middleware insertion — adding auth to an existing route is far simpler than restructuring data ownership

**Bot protection:** Rate limiting on all write endpoints from launch. App is private by URL obscurity in V1 — API abuse prevention is mandatory regardless.

## Functional Requirements

> **Capability Contract:** Every V1 capability is listed here. UX designers design what's listed. Architects support what's listed. Epics implement what's listed. Absent = does not exist.

### Recipe Management

- **FR1:** A user can create a new recipe with only a title as the required field
- **FR2:** A user can add optional content to a recipe: ingredients, steps, tags, and one photo
- **FR3:** A user can view the full detail of any recipe in their library
- **FR4:** A user can edit any field of an existing recipe at any time
- **FR5:** A user can delete a recipe from their library with a confirmation step
- **FR6:** A user can save a recipe in an incomplete state — all fields except title remain optional forever
- **FR7:** The system displays incomplete recipes as intentional — no warning indicators, badges, or draft labels

### Content Discovery

- **FR8:** A user can browse recipes from the home screen organized into thematic carousels based on tags
- **FR9:** Carousels with zero matching recipes are not rendered
- **FR10:** A user can scroll horizontally through carousel cards
- **FR11:** A user can open any recipe from a carousel in a single tap with no intermediate screen
- **FR12:** A user can browse their complete recipe library in a grid view
- **FR13:** The home screen renders carousels immediately on load without user interaction

### Recipe Capture

- **FR14:** The capture form opens with the title field focused and keyboard visible — no additional tap required to start typing
- **FR15:** The save action is available the moment the title field contains any content
- **FR16:** After saving, the system displays a brief confirmation and returns to the home screen
- **FR17:** A newly saved recipe appears in the library immediately after saving

### Recipe Reading

- **FR18:** A user can read a recipe in a single continuous scroll — photo hero, ingredients, steps — with no pagination or mode switching
- **FR19:** The system prevents the screen from dimming or locking while a user views a recipe detail
- **FR20:** A user can navigate back from a recipe detail view
- **FR21:** Ingredient and step sections only render when content exists

### Search & Retrieval

- **FR22:** A user can search their recipe library from the home screen without navigating away
- **FR23:** Search results update on every keystroke without a submit action
- **FR24:** Search matches across title, ingredients, and tags simultaneously
- **FR25:** The system displays a helpful empty state when a search query returns no results
- **FR26:** A user can open any recipe directly from search results in a single tap

### Media Management

- **FR27:** A user can add a photo to a recipe from their device camera or photo gallery
- **FR28:** A user can replace or remove an existing recipe photo
- **FR29:** The system displays a warm visual placeholder for any recipe without a photo — never a broken image state
- **FR30:** Recipes without photos appear in carousels, library, and search results identically to recipes with photos

### Responsive Experience

- **FR31:** A user on mobile experiences a bottom navigation bar for primary app navigation
- **FR32:** A user on tablet or desktop experiences a side navigation rail and expanded carousel layouts
- **FR33:** All primary user actions (capture, browse, search, read) are fully accessible on both mobile and tablet/desktop

### System & Security

- **FR34:** The system enforces rate limits on all write operations to prevent API abuse
- **FR35:** A recipe added on one device is immediately accessible on any other device without manual sync
- **FR36:** All interactive elements meet minimum touch target sizes for mobile usability
- **FR37:** All content meets WCAG 2.1 Level AA color contrast requirements
- **FR38:** All primary flows are operable via keyboard navigation on desktop

## Non-Functional Requirements

### Performance

| NFR | Requirement | Rationale |
|---|---|---|
| **NFR-P1** | Home screen carousels render within 1.5s on a standard home WiFi connection | First impression; must feel instant or habit loop doesn't form |
| **NFR-P2** | Recipe detail view loads completely (including image) within 1s of navigation | Critical cooking moment — any perceptible wait breaks the flow |
| **NFR-P3** | Search results appear within 100ms of each keystroke | Instant feel is the expectation; delay signals a broken product |
| **NFR-P4** | Recipe save completes within 500ms of tapping Save | Capture must feel instantaneous; delay undermines the 30-second target |
| **NFR-P5** | Skeleton loading states shown only if content load exceeds 150ms | Never show a loader that flashes |
| **NFR-P6** | Photo uploads proceed asynchronously — recipe is saved and accessible immediately; upload does not block any user action | Upload latency must never gate access to the saved recipe |
| **NFR-P7** | All recipe images delivered in WebP or AVIF format, sized to the requesting device | Fast load on mobile without sacrificing quality |

### Security

| NFR | Requirement | Rationale |
|---|---|---|
| **NFR-S1** | All API write endpoints enforce rate limiting | V1 publicly accessible by URL; abuse prevention mandatory from launch |
| **NFR-S2** | All data in transit encrypted via HTTPS | Standard baseline; Vercel enforces by default |
| **NFR-S3** | All data at rest encrypted | Supabase provides by default |
| **NFR-S4** | Photo storage paths namespaced by session/device token from day one | Enables per-user access control in V2 without schema migration |

### Accessibility

| NFR | Requirement | Rationale |
|---|---|---|
| **NFR-A1** | All text meets WCAG 2.1 AA contrast ratios (4.5:1 body, 3:1 large text) | Committed in UX spec; enforced, not aspirational |
| **NFR-A2** | All interactive elements minimum 44×44px touch target | iOS/Android HIG; enforced for one-handed mobile use |
| **NFR-A3** | All primary flows operable via keyboard navigation alone | Tablet/desktop use case; required for assistive technology |
| **NFR-A4** | HTML declares `lang="fr"` | French-language content requires explicit declaration |
| **NFR-A5** | All animations respect `prefers-reduced-motion` | Skeleton shimmer, card press, toast slide-in must have reduced-motion variants |
| **NFR-A6** | `eslint-plugin-jsx-a11y` runs in dev pipeline and blocks builds with violations | Prevents accessibility regressions at write time |

### Reliability

| NFR | Requirement | Rationale |
|---|---|---|
| **NFR-R1** | Failed saves surface an explicit user-visible error — no silent data loss | Silent failures are worse than visible errors |
| **NFR-R2** | Photo upload failures surface a user-visible error; the recipe remains saved and accessible | Upload failure must not cascade to recipe availability |
| **NFR-R3** | A recipe created on one device is readable on any other device within 1s of save completing | Cross-device consistency is the primary technical success requirement |
| **NFR-R4** | Wake Lock API failure produces no visible error or broken state — silent fallback only | Screen may dim; experience continues uninterrupted |
