---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
inputDocuments:
  - "docs/atable-v3-features-recap.md"
  - "_bmad-output/planning-artifacts/v1/product-brief-atable-2026-02-28.md"
  - "_bmad-output/planning-artifacts/v2/prd.md"
  - "_bmad-output/planning-artifacts/v2/architecture.md"
briefCount: 1
researchCount: 0
brainstormingCount: 0
projectDocsCount: 3
workflowType: 'prd'
classification:
  projectType: web_app
  domain: general
  complexity: low
  projectContext: brownfield
  scopeBoundary: 'AI enrichment, image generation, tags, seasons, time/cost metadata, PWA, demo isolation'
---

# Product Requirements Document - atable

**Author:** Anthony
**Date:** 2026-03-12

## Executive Summary

atable v3 adds the intelligence layer to the existing personal recipe library. V1 delivered the core recipe vault — capture, browse, search. V2 added household identity with custom session auth. V3 shifts the organizational burden from the user to the system: a single LLM call per recipe (GPT-4o-mini) automatically extracts tags, seasons, prep/cook time ranges, cost estimate, and complexity — plus generates a visual prompt that feeds DALL-E 3 for a flat-illustration image of the dish.

The driving problem: v1 carousels depend on manual tags, which users rarely bother to assign. The home screen discovery experience suffers. v3 fixes this structurally — every recipe gets rich metadata without any user effort. The result is a library that becomes more browsable and more visually consistent with every recipe added, not less.

**Scope:** AI enrichment (one LLM call per save), AI image generation (DALL-E 3 on creation, manual re-gen on edit), curated tag system with category-grouped autocompletion, season multi-select with "De saison" toggle, prep/cook time ranges, cost estimation, PWA manifest for home screen install, and demo data isolation via existing v2 shared demo household with 24h cron reset.

**Deployment strategy:** New recipes first → validate quality → batch-enrich existing recipes. This avoids paying for AI calls on content that may need prompt tuning.

**Target users:** Unchanged — household curators (couples, families) who cook intentionally. V3 doesn't change who the product is for; it changes how much the product does for them.

### What Makes This Special

| Differentiator | What it means |
|---|---|
| **One call, full enrichment** | A single GPT-4o-mini call extracts all metadata + image prompt. No prompt chains, no multi-step pipelines. Simple, fast, cheap. |
| **Never blocks the user** | Enrichment runs async post-save. The recipe is immediately visible; AI metadata appears when ready. |
| **AI fills the metadata gap** | Tags, seasons, time, cost — all inferred. Carousels and filters work from day one without manual effort. |
| **Consistent visual identity** | DALL-E 3 flat illustrations give every recipe a card image in a unified style, even without a user photo. |
| **User stays in control** | Every AI-suggested field is manually editable. The system suggests; the user decides. |
| **Curated tag taxonomy** | Predefined tags organized by category prevent tag sprawl. AI selects from the list; only the user can create new tags. |

## Project Classification

| Dimension | Value |
|---|---|
| **Project Type** | Web App (Next.js App Router, PWA) |
| **Domain** | General (consumer lifestyle) |
| **Complexity** | Low — standard web patterns, OpenAI API integration, no regulated data |
| **Project Context** | Brownfield — v3 feature layer on deployed v1 (recipe core) + v2 (household auth) |
| **Scope** | AI enrichment, image generation, tags, seasons, time/cost metadata, PWA, demo isolation |

## Success Criteria

### User Success

V3 succeeds when the library feels *smarter* — meaning recipes are browsable by tag, season, time, and cost without the user ever having manually organized them.

| Signal | What it looks like |
|---|---|
| **Effortless enrichment** | User saves a recipe with title + ingredients + steps. Within seconds, tags, seasons, prep/cook time, cost, and complexity appear — no user action required |
| **Carousels come alive** | Home screen carousels are now populated and useful. Browsing by "Rapide", "Comfort food", or "De saison" returns relevant results without manual tagging |
| **Visual consistency** | Every recipe has a card image — either a user photo or a generated flat illustration. The library grid looks cohesive |
| **AI is a suggestion, not a mandate** | Users can override any AI-assigned field. Corrections are trivial (tap, change, done) |
| **Image delight** | Generated illustrations match the dish well enough that users don't feel the need to replace them most of the time |

**Critical success moments:**
- First time a user sees a freshly saved recipe auto-populated with accurate tags and a generated image
- First time the "De saison" toggle surfaces seasonally appropriate recipes without any manual season assignment
- First time a user browses carousels that feel curated despite zero manual effort

### Business Success

atable is a personal project. Business success = v3 enrichment justifies its operational cost and delivers on the original product brief's promise of "zero-friction organization."

**V3 success gate:** AI enrichment produces usable metadata on ≥80% of recipes without manual correction, and the per-recipe cost stays under $0.05 (with image) / $0.01 (enrichment only).

**Non-regression requirement:** V3 must not increase recipe capture friction. The save flow remains instant — enrichment is invisible background work.

### Technical Success

| Requirement | Target |
|---|---|
| Enrichment latency | Async; no impact on save response time. Enrichment completes within 10s post-save |
| Image generation latency | Async; DALL-E 3 call completes within 30s post-save |
| Enrichment reliability | ≥95% success rate (retries on transient OpenAI failures) |
| Cost per recipe (enrichment only) | ~$0.01 (GPT-4o-mini structured output) |
| Cost per recipe (enrichment + image) | ~$0.05 (GPT-4o-mini + DALL-E 3 1024x1024) |
| Tag accuracy | ≥80% of AI-assigned tags require no manual correction |
| PWA installability | Manifest passes Lighthouse PWA audit |

### Measurable Outcomes

| Outcome | V3 threshold |
|---|---|
| Enrichment completion | 100% of new recipes enriched within 30s of save |
| Image generation | 100% of new recipes get a generated image on creation |
| Carousel population | Home screen carousels populated for all tag categories that have ≥2 matching recipes |
| Season filter | "De saison" toggle returns correct results based on current calendar season |
| Demo isolation | Demo visitor modifications never persist to the shared demo dataset |

## Product Scope

### MVP — This PRD

All 7 features from the v3 recap, deployed as a complete layer:

| Feature | Rationale |
|---|---|
| AI enrichment (GPT-4o-mini, async post-save) | Core value proposition — everything else depends on metadata being present |
| AI image generation (DALL-E 3, on creation only) | Visual identity for every recipe; manual re-gen on edit |
| Curated tag system (predefined + custom tags) | Structured taxonomy for carousels and filtering |
| Season multi-select + "De saison" toggle | Seasonal browsing without manual effort |
| Prep/cook time ranges | Time-based filtering ("recipes under 30 min") |
| Cost estimation (€/€€/€€€) | Budget-aware browsing |
| PWA manifest | Home screen install via native browser mechanism |
| Demo data isolation (v2 shared household + 24h reset) | Demo visitors share a sandbox; cron cleans up daily |

**Explicitly excluded from this PRD:**
- OCR / cookbook photo import
- Meal planning
- Multi-household federation
- Ingredient catalog / autocomplete
- Public recipe sharing (already in v2 scope if needed)

### Growth Features (Post-MVP)

| Feature | Notes |
|---|---|
| Batch enrichment for existing recipes | Run after validating AI quality on new recipes |
| Complexity field display + filtering | Low priority — prep+cook time already signals difficulty |
| Advanced carousel curation | AI-driven carousel themes beyond tag categories |

### Vision (V4+)

OCR import from cookbook photos, serving size adjustment, ingredient autocomplete, meal planning — as defined in the original product brief.

## User Journeys

### Journey 1 — Recipe Save → AI Enrichment (Primary Happy Path)

**Persona: Anthony, Household Curator**
*Tuesday evening. Anthony just made a great shakshuka from memory. He wants to save it before he forgets.*

**Opening scene:** Anthony opens atable, taps "Ajouter une recette." He types the title, lists the ingredients (tomates, oeufs, poivrons, cumin, coriandre…), writes the steps. No photo tonight — he already ate it. He taps "Enregistrer."

**Rising action:** The recipe saves instantly. The detail page appears — title, ingredients, steps, all there. But the tags section shows a subtle shimmer animation: enrichment is in progress. No spinner, no blocking modal. The recipe is fully readable.

**Climax:** Five seconds later, the shimmer resolves. Tags appear: "Plat", "Végétarien", "Œufs", "Indienne", "Rapide", "Comfort food." Seasons: "Été." Prep time: "10-20 min." Cook time: "15-30 min." Cost: "€." And at the top — a flat illustration of a cast-iron skillet with bubbling red sauce, poached eggs, and a sprinkle of fresh coriander. Anthony didn't do anything. The recipe organized itself.

**Resolution:** Next Sunday, when Marie browses the "Rapide" carousel, the shakshuka is there — correctly tagged, beautifully illustrated, ready to be picked for the weekly plan. The metadata gap that made v1 carousels feel thin is gone.

**Requirements revealed:** Async enrichment triggered post-save (create and edit), GPT-4o-mini structured JSON response, DALL-E 3 image generation on creation, shimmer/loading state for in-progress enrichment, all enriched fields stored and displayed on recipe detail.

---

### Journey 2 — Sunday Browsing with AI-Powered Discovery

**Persona: Marie, Household Curator**
*Sunday morning. Marie opens atable to plan the week's meals.*

**Opening scene:** The home screen loads. The carousels are different from v1 — they're populated with recipes she never manually tagged. A "De saison" toggle sits at the top of the filters. It's mid-January; she taps it.

**Rising action:** The library filters to winter recipes — root vegetables, stews, gratins, warming soups. She didn't assign seasons to any of these. She scrolls the "Rapide" carousel — 8 recipes, all genuinely under 30 minutes. She taps "Comfort food" — the gratin dauphinois, the shakshuka, the croque-monsieur are all there.

**Climax:** In 5 minutes she's picked 4 meals for the week. Every recipe card has an image — some are photos Anthony took, others are flat illustrations that match the dish. The grid looks cohesive, warm, intentional.

**Resolution:** The Sunday planning ritual that used to be "scroll and hope" is now "browse and pick." The AI metadata turned a recipe vault into a recipe library.

**Requirements revealed:** Season-based filtering with "De saison" toggle mapped to current calendar season, tag-driven carousels populated by AI-assigned tags, prep+cook time ranges enabling time-based filtering, generated images as fallback for recipes without photos, cohesive card grid mixing photos and illustrations.

---

### Journey 3 — Overriding AI Suggestions (Edge Case)

**Persona: Anthony, Household Curator**
*Anthony checks the shakshuka he saved yesterday. Something's off.*

**Opening scene:** He opens the recipe detail. The AI tagged it "Indienne" — but shakshuka is North African / Middle Eastern, not Indian. The cumin and coriander fooled the model. The illustration is also slightly wrong: it shows a tagine dish instead of a cast-iron skillet.

**Rising action:** He taps the tags section. The tag chips are editable — he removes "Indienne", starts typing "Lib" and the autocompletion grouped by category shows "Libanaise / Orientale" under "Cuisine." He selects it. One tap to remove, two taps to replace. Done.

**Climax:** He scrolls to the image. A "Régénérer l'image" button sits below it. He taps it. A brief shimmer, and 15 seconds later a new illustration appears — this time a cast-iron pan with the right composition. Better. He keeps this one.

**Resolution:** The correction took 20 seconds. The AI got 90% right; the user fixed the 10%. The overhead is negligible compared to manually tagging every field from scratch.

**Requirements revealed:** Editable tag chips with category-grouped autocompletion, manual image re-generation button (on edit view only), all AI-assigned fields manually overridable (tags, seasons, prep time, cook time, cost, complexity), re-generation triggers a new DALL-E 3 call without re-running enrichment.

---

### Journey 4 — Editing a Recipe → Re-enrichment

**Persona: Marie, Household Curator**
*Marie adapts the shakshuka recipe for a vegan version — she swaps eggs for tofu.*

**Opening scene:** She opens the recipe, taps "Modifier." She changes the ingredients: removes "œufs", adds "tofu ferme, émietté." She adjusts step 3 accordingly. Taps "Enregistrer."

**Rising action:** The recipe saves instantly. The enrichment shimmer appears — the system re-runs the LLM call with the updated content. The image does NOT re-generate (by design — image re-gen is manual only on edit).

**Climax:** Tags update: "Œufs" is removed, "Tofu / Protéines végétales" and "Végan" are added. The original "Végétarien" tag stays (still correct). Seasons, time, and cost remain unchanged — the LLM correctly determined the edit didn't affect those.

**Resolution:** The metadata stays accurate as recipes evolve. Marie didn't have to remember to update the tags manually — the system tracked the ingredient change and adjusted.

**Requirements revealed:** Re-enrichment on edit (same async flow as creation), image NOT re-generated on edit (manual re-gen only), LLM receives updated title + ingredients + steps, previous AI-assigned values replaced by new enrichment results.

---

### Journey 5 — Demo Visitor (Data Isolation)

**Persona: Claire, friend of Anthony & Marie**
*Claire heard about atable at dinner. She opens the demo the next day.*

**Opening scene:** Claire taps "Essayer l'app" on the landing screen. The demo library loads — 10 pre-seeded recipes with photos and AI-generated illustrations, tags, seasons, the full v3 experience. She browses. The "De saison" toggle works. Carousels are populated.

**Rising action:** She taps "Ajouter une recette" and enters a test recipe — "Pâtes au pesto." She saves it. The recipe appears in the demo library. Enrichment runs — tags and an image appear. She's impressed.

**Climax:** Claire and any other demo visitors share the same demo household sandbox. They can add, edit, and browse freely. The demo feels real — full v3 experience with AI enrichment and image generation.

**Resolution:** Every 24 hours, a cron job resets the demo household to its original seed state — Claire's "Pâtes au pesto" and any other visitor modifications are cleaned up. The demo is always pristine within a day. If Claire decides to create her own household, she starts fresh with an empty library.

**Requirements revealed:** Demo visitors use the existing v2 shared demo household, 24h cron reset restores seed data, demo seed data includes v3 metadata (tags, seasons, time, cost, generated images), conversion from demo to household starts with empty library.

---

### Journey 6 — PWA Home Screen Install

**Persona: Anthony, Household Curator**
*Anthony wants atable on his home screen like a native app.*

**Opening scene:** He opens atable in Safari on his iPhone. He taps the Share button, then "Add to Home Screen." Safari shows the app name ("À Table") and icon from the manifest.

**Rising action:** He taps "Add." The icon appears on his home screen alongside his other apps. He taps it.

**Climax:** Atable opens in standalone mode — no Safari URL bar, no browser chrome. The status bar matches the app's warm white theme color. It feels like a native app. Sessions persist (same cookie, same household). Everything works exactly as in the browser.

**Resolution:** From now on, Anthony opens atable from his home screen. The PWA manifest made this possible with zero custom install UI — just the browser's native "Add to Home Screen" mechanism.

**Requirements revealed:** `manifest.json` with app name, icons (multiple sizes), theme color, background color, `display: standalone`. No custom install prompt or guide. Service worker not required for v3 MVP (no offline support).

---

### Journey → Requirements Summary

| Capability | Journey(s) |
|---|---|
| Async AI enrichment (post-save, create + edit) | J1, J4 |
| DALL-E 3 image generation (on creation only) | J1 |
| Manual image re-generation | J3 |
| Enrichment loading state (shimmer) | J1, J4 |
| Tag display + category-grouped autocompletion | J2, J3 |
| Season multi-select + "De saison" toggle | J2 |
| Prep/cook time range display + filtering | J2 |
| Cost estimation display | J1 |
| All AI fields manually editable | J3 |
| Re-enrichment on edit (no image re-gen) | J4 |
| Demo isolation (v2 shared household + 24h reset) | J5 |
| PWA manifest (`display: standalone`) | J6 |
| Generated image as photo fallback | J1, J2 |

## Web App Specific Requirements

### Project-Type Overview

atable v3 adds features to an existing Next.js App Router web app. All web app foundations (browser matrix, responsive design, performance targets, accessibility) are inherited unchanged from v1/v2. This section documents only the requirements introduced or modified by v3.

### Technical Architecture Considerations

**AI integration model:** Server-side only. OpenAI API calls (GPT-4o-mini + DALL-E 3) happen exclusively in Route Handlers — never from the client. The `OPENAI_API_KEY` is a server-side environment variable, never exposed to the browser.

**Async enrichment pattern:** Post-save enrichment runs asynchronously after the HTTP response is sent to the client. The client polls or uses server-sent events to detect when enrichment completes. No WebSocket infrastructure required — the enrichment window is short (5-30s).

**Image storage:** Generated DALL-E 3 images are downloaded server-side and uploaded to the existing OVH Object Storage (S3-compatible). The recipe stores the image URL — same pattern as user-uploaded photos in v1.

**Tag storage:** Tags are stored as a relation (recipe ↔ tag), not as a JSON array on the recipe row. This enables efficient filtering and carousel queries. Predefined tags are seeded in a `tags` table; custom user tags are added to the same table.

### Browser Matrix

Inherited from v2 with no changes:

| Priority | Target | V3-specific notes |
|---|---|---|
| **Critical** | iOS Safari (iPhone) | Primary cooking surface; PWA standalone mode verified |
| **Critical** | iOS Safari (iPad) | Sunday planning; same session |
| **High** | Chrome (mobile) | Dev/testing |
| **Medium** | Safari/Chrome (macOS) | Occasional desktop use |

### Responsive Design

No changes from v2. All new UI elements (tag chips, season toggles, time/cost displays, shimmer states, re-generate button) follow the existing mobile-first, single-breakpoint-at-`lg` layout model.

### Performance Targets

See **Non-Functional Requirements > Performance** for the complete performance target table (NFR-P1 through NFR-P6). All v1/v2 performance targets remain unchanged.

### SEO Strategy

No changes. atable remains a private household app. No public recipe pages. `noindex` on landing and join pages (v2).

### Accessibility

No changes from v2 baseline (WCAG 2.1 AA, 44×44px touch targets, keyboard navigable, `lang="fr"`). New UI elements (tag chips, season toggle, time/cost selectors, shimmer loading states) must meet the same standards.

### Implementation Considerations

**Brownfield integration constraints:**
- Existing recipe form gains new display-only fields (tags, seasons, time, cost) — these are read-only post-enrichment, editable via dedicated UI
- Existing recipe detail page gains new metadata sections and generated image display
- Existing recipe card component gains generated image fallback
- No changes to existing recipe API route contracts — new metadata fields are additive columns/relations
- OVH Object Storage already configured for user photos — generated images use the same bucket and upload pattern

### PWA Requirements

| Requirement | Value |
|---|---|
| `name` | "À Table" |
| `short_name` | "À Table" |
| `display` | `standalone` |
| `start_url` | `/home` |
| `theme_color` | `#F8FAF7` (warm white) |
| `background_color` | `#F8FAF7` |
| Icons | 192x192 + 512x512 (PNG, maskable) |
| Service worker | Not required for v3 MVP (no offline support) |

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Complete feature layer — all 7 v3 features ship together. There's no meaningful "smaller MVP" because the features are tightly coupled: AI enrichment produces the tags that populate carousels, the seasons that power the "De saison" toggle, and the image prompt that feeds DALL-E 3. Shipping enrichment without the UI to display it, or shipping tag UI without enrichment to populate it, creates a half-built experience.

**Solo developer scope:** OpenAI API integration (well-documented), DB schema additions (tags table, metadata columns), async processing pattern (standard), PWA manifest (trivial). No novel architecture.

### MVP Feature Set

**Core journeys supported:** J1 (enrichment), J2 (browsing), J3 (override), J4 (re-enrichment), J5 (demo isolation), J6 (PWA).

All features from the Product Scope section above are MVP — no phasing within v3.

### Deployment Strategy

Phased rollout within MVP:

1. **Schema + enrichment pipeline** — new DB tables, OpenAI integration, async post-save flow
2. **Tag UI + metadata display** — tag chips, autocompletion, season/time/cost display on recipe detail
3. **Image generation** — DALL-E 3 integration, generated image display, re-gen button
4. **Filtering + carousels** — "De saison" toggle, tag-based carousels, time filtering
5. **PWA + demo isolation** — manifest.json, demo seed data updated with v3 metadata
6. **Validate on new recipes** → then batch-enrich existing recipes

### Risk Mitigation Strategy

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OpenAI API downtime blocks enrichment | Low | Medium | Enrichment is async + retry with backoff. Recipe saves are never blocked. Failed enrichment leaves fields empty — user can trigger manual re-enrichment later |
| GPT-4o-mini tag accuracy too low (<80%) | Medium | Medium | Prompt iteration on first 10-20 recipes before batch. System prompt includes exact tag list + examples. Structured JSON output constrains responses |
| DALL-E 3 image quality inconsistent | Low | Low | Manual re-gen button. User can always upload their own photo instead |
| OpenAI costs exceed budget | Low | Low | GPT-4o-mini is ~$0.005/recipe, DALL-E 3 is ~$0.04/image. At <200 recipes, total cost is <$10. Batch existing only after validating quality |
| Demo data pollution | Low | Low | Existing v2 shared demo household with 24h cron reset. Demo visitors share the sandbox; cron cleans up daily. Acceptable at current scale |
| PWA manifest breaks existing sessions | Low | Low | Manifest is additive — it doesn't change browser behavior unless user explicitly adds to home screen |

## Functional Requirements

### AI Enrichment

- **FR1:** The system enriches a recipe with metadata (tags, seasons, prep time, cook time, complexity, cost, image prompt) via a single LLM call after each save (create or edit)
- **FR2:** Enrichment runs asynchronously — the recipe save response is returned immediately, and enrichment completes in the background
- **FR3:** The system sends the recipe's title, ingredients, and steps to GPT-4o-mini and receives a structured JSON response containing all metadata fields
- **FR4:** The system provides the LLM with the complete list of predefined tags, season values, and time/cost ranges so it selects only from valid options
- **FR5:** If enrichment fails (API error, timeout), the recipe remains saved with empty metadata fields — the user is never blocked
- **FR6:** The system retries failed enrichment with backoff (up to 3 attempts)

### AI Image Generation

- **FR7:** On recipe creation, the system generates a flat-illustration image via DALL-E 3 (1024x1024) using the image prompt produced by enrichment
- **FR8:** On recipe edit, the system does NOT automatically re-generate the image
- **FR9:** The user can manually trigger image re-generation from the recipe detail/edit view
- **FR10:** The generated image is downloaded server-side and stored in OVH Object Storage, with the URL saved on the recipe
- **FR11:** The image prompt sent to DALL-E 3 combines the LLM-generated dish description with a fixed style suffix (flat realistic illustration, overhead angle, neutral background)
- **FR12:** If image generation fails, the recipe displays the existing placeholder or user-uploaded photo

### Tag System

- **FR13:** The system maintains a curated list of predefined tags organized by category (Type de plat, Régime alimentaire, Protéine principale, Cuisine, Occasion, Caractéristiques)
- **FR14:** The AI selects tags only from the predefined list — it cannot create new tags
- **FR15:** The user can create custom tags beyond the predefined list
- **FR16:** The user can add and remove tags on any recipe via a tag input with autocompletion grouped by category
- **FR17:** Tags display as visual chips/badges on the recipe detail view
- **FR18:** Carousels and filtering use tags to group and surface recipes

### Season

- **FR19:** Each recipe has a season field (multi-select: Printemps, Été, Automne, Hiver) — separate from tags
- **FR20:** The AI infers seasons from recipe ingredients
- **FR21:** The user can manually adjust the season selection on any recipe
- **FR22:** A "De saison" toggle filters recipes to match the current calendar season
- **FR23:** The "De saison" toggle is prominently placed in the filter/browsing UI

### Prep & Cook Time

- **FR24:** Each recipe has a prep time field selected from predefined ranges: < 10 min, 10-20 min, 20-30 min, 30-45 min, > 45 min
- **FR25:** Each recipe has a cook time field selected from predefined ranges: Aucune, < 15 min, 15-30 min, 30 min - 1h, 1h - 2h, > 2h
- **FR26:** The AI infers prep and cook time ranges from the recipe content
- **FR27:** The user can manually adjust prep and cook time on any recipe
- **FR28:** The UI can filter recipes by total time (sum of prep + cook ranges)

### Cost Estimation

- **FR29:** Each recipe has a cost field (€, €€, €€€) representing per-person cost
- **FR30:** The AI infers the cost level from the recipe ingredients
- **FR31:** The user can manually adjust the cost level on any recipe

### Complexity

- **FR32:** Each recipe has a complexity field (facile, moyen, difficile)
- **FR33:** The AI infers complexity from the recipe content
- **FR34:** The user can manually adjust the complexity on any recipe

### Enrichment UX

- **FR35:** The recipe detail view displays a shimmer/loading animation while enrichment is in progress
- **FR36:** When enrichment completes, the metadata fields update in place without requiring a page refresh
- **FR37:** All AI-assigned metadata fields are visually distinguishable as overridable (not locked)

### Demo Mode (v3 Additions)

- **FR38:** Demo seed data includes v3 metadata (tags, seasons, time, cost, complexity, generated images) so demo visitors experience the full v3 features
- **FR39:** The existing v2 demo household with 24h cron reset handles demo isolation — no local storage isolation required

### PWA

- **FR40:** The app provides a `manifest.json` enabling "Add to Home Screen" on iOS Safari and Chrome
- **FR41:** The app opens in standalone mode (no browser chrome) when launched from the home screen
- **FR42:** The manifest specifies the app name, icons, theme color, and background color consistent with the atable design system

## Non-Functional Requirements

### Performance

| NFR | Target | Context |
|---|---|---|
| **NFR-P1:** Recipe save response time | < 500ms | Enrichment is async — save must never wait for AI. Same target as v1 |
| **NFR-P2:** Enrichment completion | < 10s post-save | GPT-4o-mini structured output call. User sees shimmer → metadata appears |
| **NFR-P3:** Image generation completion | < 30s post-save | DALL-E 3 1024x1024. Slower than enrichment — separate loading state |
| **NFR-P4:** Tag autocompletion responsiveness | < 100ms | Client-side filtering on preloaded tag list. No server round-trip |
| **NFR-P5:** Home carousels with AI tags | < 1.5s | Same v1 target. Tag-based queries must not add latency vs. existing carousel queries |
| **NFR-P6:** All v1/v2 performance targets | Unchanged | No v3 feature may degrade existing page load, navigation, or interaction performance |

### Security

| NFR | Requirement |
|---|---|
| **NFR-S1:** OpenAI API key server-side only | Key stored as server env variable, used only in Route Handlers. Never exposed to client bundles or browser |
| **NFR-S2:** Generated images served via OVH Storage URLs | No direct DALL-E URLs exposed to clients. Images downloaded server-side, uploaded to OVH, served from existing CDN path |
| **NFR-S3:** All v2 security NFRs inherited | Session auth, CSRF protection, household isolation — unchanged |

### Reliability

| NFR | Requirement |
|---|---|
| **NFR-R1:** Enrichment failure is non-blocking | Recipe save succeeds regardless of enrichment outcome. Metadata fields remain empty on failure |
| **NFR-R2:** Enrichment retry with backoff | Up to 3 retries on transient OpenAI failures (429, 500, 503). Exponential backoff |
| **NFR-R3:** Image generation failure is non-blocking | Recipe displays placeholder or user photo if DALL-E 3 call fails. No error surfaced to user |
| **NFR-R4:** Graceful degradation on OpenAI outage | Full recipe CRUD continues working. AI features degrade to empty metadata + no generated image. User can still manually set all fields |

### Integration

| NFR | Requirement |
|---|---|
| **NFR-I1:** OpenAI API version pinned | API calls use a pinned model version to prevent unexpected behavior changes from model updates |
| **NFR-I2:** Structured output validation | LLM JSON response validated against expected schema before persisting. Malformed responses trigger retry, not partial save |
| **NFR-I3:** OVH Object Storage compatibility | Generated images use the same upload path, bucket, and URL pattern as existing user-uploaded photos |
