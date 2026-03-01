---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping]
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-atable-2026-02-28.md"
  - "_bmad-output/planning-artifacts/prd.md"
briefCount: 1
researchCount: 0
brainstormingCount: 0
projectDocsCount: 4
workflowType: 'prd'
classification:
  projectType: web_app
  domain: general
  complexity: low
  projectContext: brownfield
  scopeBoundary: 'Auth system only — public sharing and AI enrichment deferred to full v2'
---

# Product Requirements Document - atable v2.0

**Author:** Anthony
**Date:** 2026-03-01

## Executive Summary

atable v1.5 adds household identity to the existing personal recipe library. V1 is a complete, deployed product — a shared recipe vault accessible by URL with no concept of ownership. V1.5 introduces the missing ownership layer: a **household account** that turns the library from "accessible to anyone with the link" into "our kitchen's private vault."

The driving problem is not authentication in the technical sense — it is *belonging*. V1 recipes exist in a namespace with no owner. When two people use the app on separate devices, there is no shared identity connecting them. V1.5 solves this with a household model: one household gets one named vault, joinable by code or invite link, accessible on any device with a long-lived session. No email. No password. No individual accounts.

**Target users:** Same as V1 — household curators (couples, families) who cook intentionally. V1.5 does not change who the product is for; it changes how the product recognises them.

**Scope boundary:** This PRD covers the household auth system exclusively. Public recipe sharing (read-only URL for a single recipe, no account required) and AI enrichment remain deferred to a subsequent v2 PRD. These are architecturally distinct from household identity and must not be conflated.

### What Makes This Special

| Differentiator | What it means |
|---|---|
| **Household as the identity unit** | No individual accounts. The recipe library belongs to the kitchen, not to a person. A member leaving takes nothing — the vault stays. |
| **Codeless onboarding** | Join by a short human-readable code (e.g. `PIZZA-3847`) or an invite link. No email verification, no password reset flows, no friction between "I want to try this" and "I'm in." |
| **Long-lived device trust** | Sessions last ~1 year. The app behaves like a trusted household tool, not a service you re-authenticate to. |
| **Demo mode as discovery** | A friend can experience the full app with real-looking test data before committing to creating their own household. Zero-barrier evaluation. |
| **Device-level access control** | Members can see all connected devices and revoke any of them — without individual accounts to manage. Revocation is per-device, not per-person. |

## Success Criteria

### User Success

V1.5 succeeds when the household auth system is invisible — meaning it works so reliably that members never think about it after the initial setup. Success is behavioral, not numerical.

| Signal | What it looks like |
|---|---|
| **Seamless first join** | A new household member joins via code or invite link in under 2 minutes, with no confusion about what a "household" is or what they're joining |
| **No re-authentication friction** | No household member is unexpectedly logged out or prompted to re-enter their code within a 1-year session window |
| **Demo converts** | A friend exploring demo mode has a clear, frictionless path to creating their own household when they decide to commit |
| **Device management is self-service** | A member can revoke a lost or shared device without needing support — the flow is findable and unambiguous |
| **Household feels owned** | Both members see the same library, the same recipes, the same home screen — the app is "ours", not "mine and a copy of yours" |

**Critical success moments:**
- First time both household members open the same library from different devices
- First successful join via invite link shared over WhatsApp or SMS
- First device successfully revoked without confusion

### Business Success

atable is a household product. Business success = V1.5 extends the V1 success gate rather than breaking it.

**V1.5 success gate:** The household auth system is configured and actively used by both household members within the first week of deployment, with no disruption to the existing V1 recipe library or daily usage patterns.

**Non-regression requirement:** V1.5 must not reduce the frequency or ease of recipe capture, browsing, or reading. Auth must be invisible during normal app use — it only surfaces at first login and in the household menu.

### Technical Success

**Session reliability is the primary technical requirement.** An auth layer that causes unexpected logouts or forces re-authentication undermines the entire value proposition of long-lived device trust.

| Requirement | Target |
|---|---|
| Session duration | ~1 year; no expiry under normal use |
| Join code rate limiting | ≤ 5 attempts per hour per IP, enforced without user-visible degradation on legitimate use |
| Demo data reset | Exactly every 24 hours; no stale test data persists |
| Device revocation | Revoked device loses access within 1 request cycle; no grace period |
| Onboarding flow completion | Household creation or join completes in under 2 minutes on first attempt |

### Measurable Outcomes

| Outcome | V1.5 threshold |
|---|---|
| Onboarding to active session | Under 2 minutes from landing screen to library |
| Join via invite link | Zero additional steps beyond clicking the link |
| Session persistence | Zero unexpected logouts in 30-day post-launch window |
| Library continuity | All V1 recipes visible and unchanged after auth migration |

## Product Scope

### MVP — This PRD

The complete household auth system as specified: landing screen (create / join / demo), household creation, join by code, join by invite link, long-lived sessions, household menu (view/copy code, copy invite link, list devices, revoke device, leave household), rate limiting on join code endpoint, demo mode with 24h reset.

**Explicitly excluded from this PRD:** Public recipe sharing, AI enrichment, individual user profiles, household-to-household recipe sharing, account recovery by email.

### Growth Features (Full v2 PRD)

- Public read-only recipe URL (share a single recipe without account requirement)
- AI async enrichment (auto-tags, duration, calorie generation)

### Vision (V3+)

As defined in the V1 PRD: OCR import, AI photo generation, full AI auto-tagging, multi-household federation.

## User Journeys

### Journey 1 — Household Creation (Primary Happy Path)

**Persona: Anthony, Household Curator**
*Sunday afternoon. V1.5 just deployed. Anthony opens atable and sees a screen he hasn't seen before.*

**Opening scene:** The familiar home screen is gone. In its place: a clean landing with three choices — "Créer un foyer", "Rejoindre un foyer", "Essayer l'app". The app is asking who he is for the first time. He's not confused — the choices are unambiguous.

**Rising action:** He taps "Créer un foyer." A single field appears: the household name. He types "Chez nous." Taps confirm. That's it.

**Climax:** The home screen loads — his carousels, his recipes, exactly as before. A quiet banner: "Foyer *Chez nous* créé. Code : OLIVE-4821." He taps it, copies the code, and sends it to Alice over iMessage.

**Resolution:** The library is theirs now. Not just accessible by URL — owned, named, theirs. The code is in the chat; Alice will join later.

**Requirements revealed:** Landing screen with 3 options, household name field, auto-generated join code displayed immediately post-creation, seamless transition to existing library, copy-code affordance.

---

### Journey 2 — Joining via Invite Link (Primary Happy Path)

**Persona: Alice, Household Curator**
*Sunday evening. Alice taps the link Anthony sent.*

**Opening scene:** Safari opens. The atable landing screen appears — but with the household name already pre-filled: "Rejoindre *Chez nous*?" One tap to confirm. No code to type. No form to fill.

**Rising action:** She taps "Rejoindre." The app loads. Her phone is now part of the household.

**Climax:** The home screen. Anthony's recently added recipes are there — including the lamb she added from her phone two months ago. Same library. Different device. One kitchen.

**Resolution:** Neither of them had to explain what a "household" is, what a "session" means, or what happens to existing data. It just worked.

**Requirements revealed:** `/join/[CODE]` route that pre-fills household and requires one-tap confirmation, immediate library access post-join, device registered silently in device list.

---

### Journey 3 — Manual Code Join (Edge Case)

**Persona: Alice, Household Curator**
*Same scenario, but the link didn't open correctly on her phone.*

**Opening scene:** The link opens a blank page. She goes back to iMessage, looks at the code — `OLIVE-4821` — and opens atable manually.

**Rising action:** She taps "Rejoindre un foyer." A field appears: "Code du foyer." She types `OLIVE-4821`. The field accepts it immediately — no submit button needed once the format is recognized.

**Climax:** "Foyer *Chez nous* trouvé — Rejoindre ?" One confirmation tap. Done.

**Resolution:** Same outcome as Journey 2. The code path is the fallback that works when the link doesn't — and it's fast enough that it's not a frustrating fallback.

**Requirements revealed:** Code entry field with format validation, household name preview before confirmation, rate limiting transparent to legitimate users (5 attempts/hour/IP).

---

### Journey 4 — Demo Mode → Conversion (Secondary User)

**Persona: Marie, friend of Anthony & Alice**
*Marie heard about atable at dinner. She opens it on her phone the next day.*

**Opening scene:** The landing screen. "Essayer l'app" catches her eye — no commitment implied. She taps it.

**Rising action:** A library appears: warm photos, real-looking recipes in French, carousels organized by mood. She browses. She adds a test recipe. She searches. Everything works. After 10 minutes she thinks: "I'd actually use this."

**Climax:** A subtle prompt — not a popup, not a modal — appears at the bottom: "Créer votre propre foyer." She taps it. The create-household flow appears. She types "Chez Marie." Done.

**Resolution:** Her demo session is gone — the test data resets. Her new household is empty and hers. She opens her camera roll and starts adding her first real recipe.

**Requirements revealed:** Demo mode with realistic seed data, 24h auto-reset, conversion CTA accessible but non-intrusive, create-household flow reachable from demo, demo recipes not carried over on conversion.

---

### Journey 5 — Device Revocation (Device Management)

**Persona: Anthony, Household Curator**
*Anthony lost his old iPhone. It still has an active session on atable.*

**Opening scene:** From his new phone, already logged into the household, he opens the household menu (accessible from the app nav). He sees "Appareils connectés" — a list of device names with last-seen dates.

**Rising action:** He spots "iPhone 13 Pro — il y a 3 semaines." That's the lost phone. He taps it. "Révoquer l'accès ?" — one confirmation tap.

**Climax:** The device is removed from the list. The next time that phone tries to access atable, it hits the landing screen instead of the library. No data was deleted — just the session.

**Resolution:** The household is secure. No email to send. No support ticket. No password to change. Two taps from the menu.

**Requirements revealed:** Household menu accessible from app nav, device list with name + last-seen date, per-device revocation with confirmation, immediate session invalidation on revocation.

---

### Journey 6 — V1 Migration (Existing User, First Login Post-Upgrade)

**Persona: Anthony, existing V1 user**
*Anthony opens atable the morning after V1.5 deploys. He expects the home screen.*

**Opening scene:** The landing screen appears instead. He hasn't seen it before — no prior household exists. The copy is clear: his recipes are safe, he just needs to create or join a household to access them.

**Rising action:** He taps "Créer un foyer," names it "Chez nous," confirms. The home screen loads — all carousels, all recipes, exactly as he left them.

**Climax:** Nothing is missing. Nothing changed. The auth layer was added *around* the existing library without touching it. The friction was one extra step, once, ever.

**Resolution:** He sends Alice the code. She joins. From this point on, both their devices are tied to the same household and the upgrade is transparent in daily use.

**Requirements revealed:** V1 recipe data preserved and associated with the new household on creation, clear copy on landing screen for returning users, no data migration step visible to user.

---

### Journey → Requirements Summary

| Capability | Journey(s) |
|---|---|
| Landing screen (3 options) | J1, J3, J4, J6 |
| Household creation (name → code) | J1, J4, J6 |
| Join via invite link (`/join/[CODE]`) | J2 |
| Join via manual code entry | J3 |
| Household name preview before join | J3 |
| Rate limiting on code entry | J3 |
| Long-lived session (1 year) | J2, J3 |
| Demo mode with seed data | J4 |
| 24h demo reset | J4 |
| Demo → create household conversion | J4 |
| Household menu in app nav | J5 |
| Device list with last-seen | J5 |
| Per-device revocation | J5 |
| V1 data preserved on household creation | J6 |

## Web App Specific Requirements

### Project-Type Overview

atable v1.5 adds an auth layer to an existing Next.js App Router web app. All web app foundations (browser matrix, responsive design, performance targets, accessibility) are inherited unchanged from V1. This section documents only the requirements introduced or modified by the auth system.

### Technical Architecture Considerations

**Authentication model:** Custom household auth — no third-party auth provider (no Supabase Auth, no NextAuth, no OAuth). Sessions are managed via httpOnly secure cookies with a ~1-year expiry. This approach is deliberately chosen over standard auth to eliminate individual account complexity and support long-lived device trust on iOS Safari.

**Next.js middleware:** A single middleware file intercepts all requests and enforces the session gate.

| Route pattern | Auth required | Notes |
|---|---|---|
| `/` | No | Landing screen — always public |
| `/join/[CODE]` | No | Invite link target — must work unauthenticated |
| All other routes | Yes | Redirect to `/` if no valid session cookie |

**Session cookie spec:**
- `httpOnly: true` — not accessible to JavaScript (XSS protection)
- `secure: true` — HTTPS only
- `sameSite: lax` — compatible with invite link navigation from external apps (SMS, WhatsApp)
- `maxAge: ~365 days`
- Payload: household ID + device ID (signed, not encrypted — no sensitive data in cookie)

**Demo household:**
- Single shared household in DB, flagged `is_demo: true`
- Pre-seeded with realistic recipe data (same seed as V1 test fixtures)
- Shared across all simultaneous demo users — intentional, not a bug
- Reset by scheduled cron job every 24h (Vercel Cron or Supabase pg_cron)
- Demo sessions use same cookie mechanism as real sessions; distinguished by `is_demo` flag on the household row
- On "Créer votre propre foyer" from demo: new household created, demo session replaced, demo data not carried over

### Browser Matrix

Inherited from V1 with one addition:

| Priority | Target | Auth-specific notes |
|---|---|---|
| **Critical** | iOS Safari (iPhone) | Primary join + session surface; cookie persistence verified |
| **Critical** | iOS Safari (iPad) | Sunday planning session; same session as iPhone |
| **High** | Chrome (mobile) | Dev/testing; cookie behaviour verified |
| **Medium** | Safari/Chrome (macOS) | Occasional desktop use |
| **New** | External link handlers (SMS, WhatsApp) | `/join/[CODE]` must open correctly from these apps on iOS; `sameSite: lax` required |

### Responsive Design

No changes from V1. The landing screen (create / join / demo) and household menu follow the same mobile-first, single-breakpoint-at-`lg` layout model.

### Performance Targets

| Flow | Target |
|---|---|
| Landing screen render | < 500ms (static, no data fetch) |
| Middleware session check | < 10ms overhead per request (cookie validation only, no DB call on hot path) |
| Household creation (name → code) | < 500ms (single DB write) |
| Join by code (validation + session) | < 500ms (one DB read + one write) |
| `/join/[CODE]` page render | < 500ms (pre-rendered with code param) |

**Session validation strategy:** Middleware validates the signed cookie locally (no DB call) on every request. DB is only hit when a cookie is absent, invalid, or when the device-revocation check is explicitly needed (household menu load).

### SEO Strategy

No public pages introduced. The landing screen (`/`) and `/join/[CODE]` are not indexed — `noindex` meta tag on both. Consistent with V1's private-vault positioning.

### Accessibility

No changes from V1 baseline (WCAG 2.1 AA, 44×44px touch targets, keyboard navigable, `lang="fr"`). The landing screen and household menu must meet the same standards as all V1 flows.

### Implementation Considerations

**Brownfield integration constraints:**
- Existing V1 recipes have no `household_id` — the migration must associate all existing recipes with the newly created household at creation time, in a single atomic operation
- No change to existing recipe API routes — auth middleware handles the gate before requests reach route handlers
- `household_id` foreign key was architecturally planned in V1 (`user_id` placeholder); this is the migration that activates it

### Project Classification

| Dimension | Value |
|---|---|
| **Project Type** | Web App (Next.js App Router, PWA) |
| **Domain** | General (consumer lifestyle) |
| **Complexity** | Low — standard session patterns, no regulated data |
| **Project Context** | Brownfield — additive auth layer on complete, deployed V1 |
| **Scope** | Household auth only; public sharing & AI deferred to full v2 |

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Incremental brownfield — auth system added as a complete, non-regressive layer on top of V1. The MVP is the full auth spec as specified. There is no smaller useful subset: an auth layer that can't revoke devices or join by link is incomplete by design.

**Solo developer scope:** Standard session management, cookie auth, Supabase DB operations. No novel architecture. Estimated complexity: medium-low.

### MVP Feature Set — V1.5 (This PRD)

**Core journeys supported:** J1 (household creation), J2 (join via link), J3 (join via code), J4 (demo → convert), J5 (device revocation), J6 (V1 migration).

**Must-have capabilities:**

| Capability | Rationale |
|---|---|
| Landing screen (create / join / demo) | Entry point for all users — without this nothing works |
| Household creation (name + auto-generated code) | Core identity creation |
| Join via invite link (`/join/[CODE]`) | Primary join path; must work from SMS/WhatsApp on iOS |
| Join via manual code entry | Fallback join path; covers link-failure edge case |
| httpOnly cookie session (~1yr) | Core UX promise of long-lived device trust |
| Next.js middleware auth gate | Protects all existing V1 routes |
| Rate limiting on code entry (5/hr/IP) | Security requirement; without it the join code is brute-forceable |
| Demo mode (shared sandbox, 24h reset) | Discovery path for new users; cron reset required |
| Demo → create household conversion | Without this, demo mode is a dead end |
| Household menu (code, invite link, devices, revoke, leave) | Device management is essential; leaving household is included for completeness |
| V1 data migration (atomic recipe → household association) | **Highest-risk deliverable** — existing library must survive the upgrade intact |

**Explicitly excluded from this PRD:**
- Public recipe sharing (read-only URL per recipe)
- AI enrichment
- Email-based account recovery
- Individual user profiles within a household

### Post-MVP (Full v2 PRD)

| Feature | Notes |
|---|---|
| Public recipe sharing | Read-only URL for a single recipe; no account required to view |
| AI async enrichment | Background job: auto-tags, duration, calorie generation |

### Vision (V3+)

OCR import, AI photo generation, full AI auto-tagging, multi-household federation — as defined in V1 PRD.

### Risk Mitigation Strategy

| Risk | Likelihood | Mitigation |
|---|---|---|
| V1 data migration failure (recipes lost on first household creation) | Medium | Atomic DB transaction; migration tested on staging with production data clone before deploy |
| iOS Safari cookie not persisting (ITP restrictions) | Low | `sameSite: lax`, first-party cookie only; verified in testing |
| `/join/[CODE]` link not opening correctly from WhatsApp/SMS on iOS | Medium | Test with real SMS/WhatsApp links pre-launch; `sameSite: lax` is the correct setting |
| Demo cron job failure (stale test data persists) | Low | Cron health check; demo reset failure is non-critical — test data accumulates but app still works |
| Join code brute-force (rate limit bypassed via IP rotation) | Low | Rate limiting is a deterrent, not a guarantee — acceptable risk for a personal household app |
| Cookie-based custom auth introduces XSS surface | Low | httpOnly cookie is not JS-accessible; standard headers (CSP, X-Frame-Options) inherited from V1 |

