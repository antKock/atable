---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
documentsUsed:
  prd: prd-v2.md
  architecture: architecture-v2.md
  epics: epics-v2.md
  ux: ux-design-specification-v2.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-03-02
**Project:** atable

---

## Step 1: Document Inventory

| Document Type | File | Size | Modified |
|---|---|---|---|
| PRD | `prd-v2.md` | 28 KB | 2026-03-02 |
| Architecture | `architecture-v2.md` | 41 KB | 2026-03-02 |
| Epics & Stories | `epics-v2.md` | 32 KB | 2026-03-02 |
| UX Design | `ux-design-specification-v2.md` | 75 KB | 2026-03-02 |

All v2 documents confirmed by user for assessment.

---

## Step 2: PRD Analysis

### Functional Requirements (27 total)

**Onboarding & Entry**
- FR1: A new user can choose between creating a household, joining an existing household, or trying a demo from the landing screen
- FR2: An unauthenticated user accessing any protected route is redirected to the landing screen

**Household Management**
- FR3: A user can create a household by providing a household name
- FR4: The system auto-generates a unique human-readable join code in WORD-NNNN format (e.g. OLIVE-4821) upon household creation
- FR5: A household member can view their household's join code from the household menu
- FR6: A household member can copy an invite link for their household from the household menu
- FR7: A household member can view and edit the household name from the household menu
- FR8: A household member can leave their household from the household menu; if they are the last member, the household and all its data are permanently deleted

**Joining a Household**
- FR9: A user can join a household by entering a join code manually
- FR10: The system displays the household name for preview before the user confirms joining by code
- FR11: A user can join a household by opening an invite link, with the household pre-identified and join requiring a single confirmation tap
- FR12: The system rejects join code attempts beyond 5 per hour per IP address
- FR13: The system displays an error message when a submitted join code does not match any household

**Session & Device Management**
- FR14: The system creates a long-lived device session (~1 year) upon joining a household
- FR15: A household member can view all devices connected to the household, with device name and last-seen date
- FR16: A household member can revoke access for any individual connected device
- FR17: A device whose session has been revoked loses access on its next request — no grace period
- FR18: Connected devices are identified by a human-readable name (browser/OS/device type)

**Demo Mode**
- FR19: A user can access a demo of the app — providing access to all V1 recipe browsing, capture, search, and reading capabilities — without creating a household or entering any credentials
- FR20: The demo presents a pre-seeded library with recipe data matching V1 test fixtures
- FR21: The system resets all demo data every 24 hours automatically
- FR22: A demo user can exit the demo at any time via a persistent "Quitter la démo" banner, returning to the landing screen where they can create or join a household
- FR23: Demo recipes are not carried over when a demo user creates their own household

**Authentication Gate**
- FR24: All application routes except the landing screen (`/`) and the invite link route (`/join/[CODE]`) require a valid session
- FR25: The invite link route loads the join confirmation screen with the household name pre-populated when opened from external apps (SMS, WhatsApp, email)

**Data Migration**
- FR26: When a user creates the first household on a V1 deployment, all existing recipes are associated with that household in a single atomic operation
- FR27: All V1 recipe data is fully accessible and unchanged after household creation

---

### Non-Functional Requirements (15 total)

**Performance (5)**
- NFR-P1: Middleware session validation adds < 10ms overhead per request (local cookie validation, no DB call on hot path)
- NFR-P2: Landing screen renders in < 500ms (static page, no data fetch)
- NFR-P3: Household creation completes in < 500ms (single DB write + session set)
- NFR-P4: Join by code (validation + session creation) completes in < 500ms (one DB read + one write)
- NFR-P5: All V1 performance targets (home screen < 1.5s, recipe detail < 1s, search < 100ms, save < 500ms) remain unaffected after auth layer is added

**Security (5)**
- NFR-S1: Session cookie is `httpOnly: true`, `secure: true`, `sameSite: lax`, `maxAge: ~365 days`
- NFR-S2: Cookie payload contains only household ID and device ID; no sensitive personal data; payload is signed, not encrypted
- NFR-S3: Join code rate limiting is enforced server-side at ≤ 5 attempts per hour per IP, independently of client behaviour
- NFR-S4: A revoked device's session is invalidated within one request cycle — no stale access window
- NFR-S5: All V1 security NFRs (HTTPS in transit, data at rest encryption, API write rate limiting) remain in force

**Reliability (4)**
- NFR-R1: The V1 data migration is atomic: all existing recipes associated with the new household in a single DB transaction, or none are
- NFR-R2: A failed household creation or join attempt leaves no orphaned DB rows
- NFR-R3: Demo data reset failure is non-blocking — demo mode remains functional; no user-visible error
- NFR-R4: Any session validation failure produces a clean redirect to the landing screen — never a 5xx error, broken state, or data exposure

**Accessibility (3)**
- NFR-A1: Landing screen, join flows, and household menu meet WCAG 2.1 AA standards (4.5:1 body contrast, 3:1 large text)
- NFR-A2: All new interactive elements meet minimum 44×44px touch targets
- NFR-A3: All new flows (landing, create, join, household menu) are fully operable via keyboard navigation alone

---

### Additional Requirements & Constraints

- **Brownfield constraint:** All existing V1 recipe API routes must require no changes — auth middleware handles the gate before requests reach route handlers
- **No third-party auth:** Custom household auth only (no Supabase Auth, no NextAuth, no OAuth)
- **Demo household:** Single shared DB row flagged `is_demo: true`; shared across all simultaneous demo users intentionally
- **Route access table:** `/` (public), `/join/[CODE]` (public), all others require valid session
- **SEO:** `/` and `/join/[CODE]` use `noindex` — not indexed
- **iOS Safari specific:** `sameSite: lax` required for invite link compatibility with SMS/WhatsApp on iOS

### PRD Completeness Assessment

The PRD is exceptionally complete and precise. Requirements are numbered, grouped by capability, and directly traceable to user journeys. The scope boundary (auth only; public sharing and AI deferred) is explicit. The brownfield constraint and the V1 migration risk are clearly called out. No ambiguities identified that would block implementation.

---

## Step 3: Epic Coverage Validation

### FR Coverage Matrix

| FR | PRD Requirement (summary) | Epic / Story | Status |
|---|---|---|---|
| FR1 | Landing screen with 3 options | Epic 1 / Story 1.3 | ✅ Covered |
| FR2 | Unauthenticated redirect to landing | Epic 1 / Story 1.2 | ✅ Covered |
| FR3 | Create household by providing name | Epic 1 / Story 1.3 | ✅ Covered |
| FR4 | Auto-generate WORD-NNNN join code | Epic 1 / Story 1.3 | ✅ Covered |
| FR5 | View join code from household menu | Epic 4 / Story 4.1 | ✅ Covered |
| FR6 | Copy invite link from household menu | Epic 4 / Story 4.1 | ✅ Covered |
| FR7 | View and edit household name | Epic 4 / Story 4.2 | ✅ Covered |
| FR8 | Leave household; last member deletes all data | Epic 4 / Story 4.4 | ✅ Covered |
| FR9 | Join household via manual code entry | Epic 2 / Story 2.1 | ✅ Covered |
| FR10 | Household name preview before confirming join | Epic 2 / Story 2.1 | ✅ Covered |
| FR11 | Join via invite link (one-tap confirm) | Epic 2 / Story 2.2 | ✅ Covered |
| FR12 | Rate limiting: 5 attempts/hr/IP on code entry | Epic 2 / Story 2.1 | ✅ Covered |
| FR13 | Error message on unknown join code | Epic 2 / Story 2.1 | ✅ Covered |
| FR14 | Long-lived session (~1 year) on creation/join | Epic 1 / Stories 1.3, 2.1, 2.2 | ✅ Covered |
| FR15 | View all connected devices (name + last-seen) | Epic 4 / Story 4.3 | ✅ Covered |
| FR16 | Per-device revocation | Epic 4 / Story 4.3 | ✅ Covered |
| FR17 | Revoked device loses access on next request | Epic 4 / Story 4.3 | ✅ Covered |
| FR18 | Human-readable device name (UA parsing) | Epic 1 / Story 1.1 + Epic 4 / Story 4.3 | ✅ Covered |
| FR19 | Demo access without credentials | Epic 3 / Story 3.1 | ✅ Covered |
| FR20 | Demo presents pre-seeded library | Epic 3 / Story 3.1 | ✅ Covered |
| FR21 | 24h automated demo reset | Epic 3 / Story 3.2 | ✅ Covered |
| FR22 | Persistent "Quitter la démo" banner → landing | Epic 3 / Story 3.2 | ✅ Covered |
| FR23 | Demo data not carried over on conversion | Epic 3 / Story 3.2 | ✅ Covered |
| FR24 | Auth gate on all routes except `/` and `/join/[CODE]` | Epic 1 / Story 1.2 | ✅ Covered |
| FR25 | Invite link loads join screen with household pre-populated | Epic 2 / Story 2.2 | ✅ Covered |
| FR26 | Atomic V1 migration on first household creation | Epic 1 / Story 1.3 | ✅ Covered |
| FR27 | All V1 data preserved and accessible post-creation | Epic 1 / Story 1.3 | ✅ Covered |

### NFR Coverage in Acceptance Criteria

| NFR | Explicitly in ACs | Story |
|---|---|---|
| NFR-P1 (middleware < 10ms) | ✅ Yes | Story 1.2 |
| NFR-P2 (landing < 500ms) | ✅ Yes | Story 1.3 |
| NFR-P3 (household creation < 500ms) | ⚠️ Implicit only | Story 1.3 (no explicit timing AC) |
| NFR-P4 (join by code < 500ms) | ⚠️ Implicit only | Story 2.1 (no explicit timing AC) |
| NFR-P5 (V1 perf targets unaffected) | ⚠️ Implicit only | No story explicitly verifies this non-regression |
| NFR-S1 (cookie spec) | ✅ Yes | Stories 1.3, 2.1, 2.2 |
| NFR-S2 (cookie payload: no PII, signed) | ✅ Yes | Story 1.3 |
| NFR-S3 (rate limit server-side) | ✅ Yes | Story 2.1 |
| NFR-S4 (revoked device: immediate) | ✅ Yes | Story 4.3 |
| NFR-S5 (V1 security NFRs remain) | ⚠️ Implicit only | No story explicitly verifies this |
| NFR-R1 (atomic V1 migration) | ✅ Yes | Story 1.3 |
| NFR-R2 (no orphaned rows on failure) | ✅ Yes | Story 1.3 |
| NFR-R3 (demo reset failure non-blocking) | ✅ Yes | Story 3.2 |
| NFR-R4 (session failure → clean redirect) | ✅ Yes | Story 1.2 |
| NFR-A1 (WCAG 2.1 AA) | ✅ Yes | Story 1.3 |
| NFR-A2 (44×44px touch targets) | ✅ Yes | Stories 1.3, 2.1 |
| NFR-A3 (keyboard navigable) | ✅ Yes | Stories 1.3, 4.1 |

### Missing Requirements

No FRs are missing from epic coverage. All 27 FRs are fully addressed.

**Minor NFR gaps (implicit, not blocking):**
- **NFR-P3, NFR-P4**: No explicit performance timing ACs in Stories 1.3 or 2.1. The 500ms targets are stated in the PRD and Architecture but not as testable ACs. Recommend adding a note in the story implementation notes rather than a story change.
- **NFR-P5, NFR-S5**: Non-regression requirements have no explicit story coverage. These are cross-cutting concerns assumed to be validated at deploy time. Low risk since the auth layer doesn't modify V1 core routes.

### Coverage Statistics

- Total PRD FRs: **27**
- FRs covered in epics: **27**
- FR Coverage: **100%**
- NFRs with explicit AC coverage: **12 / 15 (80%)**
- NFRs implicitly covered: **3 / 15 (performance non-regression + V1 security baseline)**

---

## Step 4: UX Alignment Assessment

### UX Document Status

**Found:** `ux-design-specification-v2.md` (75 KB, 2026-03-02). Comprehensive document covering: executive summary, core UX, emotional design, design system, user journey flows (J1–J6), component strategy, responsive design, and accessibility. Was listed as an explicit input to both `prd-v2.md` and `architecture-v2.md`.

---

### UX ↔ PRD Alignment

**Overall: Fully aligned. No blocking misalignments.**

| UX Area | PRD Alignment |
|---|---|
| 3-option landing screen (Essayer / Créer / Rejoindre) | FR1 ✅ |
| Household creation (one field, one tap) | FR3, FR4 ✅ |
| Join via invite link (one-tap confirm with household name) | FR11, FR25 ✅ |
| Join via manual code + household name preview | FR9, FR10, FR12, FR13 ✅ |
| Long-lived session / device trust | FR14 ✅ |
| Demo mode (full V1 experience, no credentials) | FR19, FR20 ✅ |
| "Quitter la démo" persistent banner → landing exit | FR22 ✅ |
| 24h demo reset (cron, non-blocking) | FR21, FR23 ✅ |
| Household menu via Users icon (top-right header, not nav) | FR5, FR6, FR7, FR15, FR16 ✅ |
| Device revocation (optimistic UI, immediate invalidation) | FR16, FR17 ✅ |
| Last-member leave = full household deletion | FR8 ✅ |
| V1 migration (atomic, invisible to user) | FR26, FR27 ✅ |
| Auth gate for all routes except `/` and `/join/[CODE]` | FR2, FR24 ✅ |

**One minor copy note:** The UX spec mentions "Créer votre propre foyer" as a conversion CTA text for demo mode, but Story 3.2 uses the PRD/FR22 canonical language "Quitter la démo." Both documents agree the banner exits to landing — the CTA label is a minor implementation detail. No alignment issue.

---

### UX ↔ Architecture Alignment

**Overall: Strongly aligned. Architecture was built with UX spec as an explicit input.**

| UX Requirement | Architecture Coverage |
|---|---|
| LandingLayout (no nav, gradient background) | Route group `(landing)/` with separate layout — ✅ |
| Household menu as full-screen push view (`/household`) | New `/household` route in `(app)/` group — ✅ |
| Demo banner fixed in nav area during demo session | Middleware forwards `is_demo` flag; demo session distinguished by household row — ✅ |
| `sameSite: lax` for iOS WhatsApp/SMS invite link | Cookie spec specifies `sameSite: lax` — ✅ |
| Device name: `"{Device} · {Browser}"` (U+00B7) | `lib/auth/device-name.ts` via `bowser` — ✅ |
| `useOptimistic` for device revocation | Redis `SET revoked:{sid}` for server + story specifies `useOptimistic` — ✅ |
| `min-h-dvh` for iOS Safari viewport sizing | Implementation guideline in UX spec; not in architecture doc but low-risk implementation detail |
| WCAG 2.1 AA + `aria-describedby` on form errors | NFR-A1/A2/A3 captured in architecture — ✅ |
| Auto-focus input fields on screen mount | UX spec implementation guideline — not in architecture or stories ACs (minor) |
| Ghost button variant (may not exist in V1 shadcn) | Not called out explicitly in any story — minor risk, straightforward fix |

---

### Warnings

**Low-risk implementation details not captured as story ACs:**

1. **`min-h-dvh` on landing screen** — UX spec correctly specifies this for iOS Safari's dynamic toolbar behavior. Not in any story's AC. Risk: a developer could use `h-screen` instead, which breaks on iOS. Recommend adding to Story 1.3 implementation notes or dev notes.

2. **Auto-focus on form input mount** — UX spec requires focus management (`useEffect` to set focus on mount). Not in any story AC. Low risk but a notable UX detail.

3. **Ghost/tertiary button variant** — UX spec calls for "Rejoindre un foyer" on landing to use a ghost/tertiary variant. Not confirmed to exist in V1. If missing, a developer may need to add it. Not currently in any story AC.

4. **`CopyableField` shared abstraction** — UX spec notes CodeDisplay and InviteLinkDisplay could share a `CopyableField` base pattern. Not a story-level requirement, just a code quality suggestion. No risk to implementation.

**No blocking alignment issues found between UX, PRD, and Architecture.**

---

## Step 5: Epic Quality Review

### Epic Structure Validation

#### Epic 1: Household Creation & Auth Foundation

**User Value:** ✅ Title is partially technical ("Auth Foundation") but the epic goal is user-centric: "A user can create a named household, establish a long-lived device session, and access their protected recipe library with all V1 data intact." A V1 user can upgrade and access their library — real user value delivered.

**Independence:** ✅ Stands alone. After Epic 1, a user can create a household and access the full V1 library. No dependency on any subsequent epic.

**Story sequencing (intra-epic dependencies):**
- 1.1 → 1.2 → 1.3 (correct forward order; each story builds on the prior) ✅

---

#### Epic 2: Joining a Household

**User Value:** ✅ "A user can join an existing household via invite link or manual code entry." Clear user outcome.

**Independence:** ✅ Depends only on Epic 1 infrastructure (session utils, DB schema, rate limiter). No dependency on Epic 3 or 4.

**Story sequencing:** 2.1 (manual code join) → 2.2 (invite link join). Note: both stories share `POST /api/households/join`. Story 2.1 likely introduces the route; Story 2.2 reuses it. ✅

---

#### Epic 3: Demo Mode

**User Value:** ✅ "A new user can explore the full app experience with a realistic pre-seeded library." Clear non-authenticated discovery value.

**Independence:** ✅ Depends only on Epic 1 infrastructure (session mechanism, household schema). No dependency on Epic 2 or 4.

**Story sequencing:** 3.1 (entry + seed data) → 3.2 (exit banner + reset). ✅

---

#### Epic 4: Household Management & Device Control

**User Value:** ✅ "A household member can view and share the household code and invite link, rename the household, manage connected devices, revoke any device, and leave the household." Clear management capabilities.

**Independence:** ✅ Depends only on Epic 1 (household and device session must exist). No dependency on Epic 2 or 3.

**Story sequencing:** 4.1 (menu + code/link) → 4.2 (rename) → 4.3 (device management) → 4.4 (leave). Each story builds on prior story's menu existence. ✅

---

### Story Quality Assessment

| Story | User Persona | ACs Format | Error Paths | Sizing | Verdict |
|---|---|---|---|---|---|
| 1.1 DB Schema & Auth Infrastructure | Developer (technical) | Given/When/Then ✅ | N/A (setup story) | Large but coupled ⚠️ | Acceptable |
| 1.2 Auth Middleware Gate | Household member ✅ | Given/When/Then ✅ | Session failure → clean redirect ✅ | Appropriate ✅ | Pass |
| 1.3 Household Creation & V1 Migration | V1 user ✅ | Given/When/Then ✅ | Rollback on failure ✅ | Appropriate ✅ | Pass |
| 2.1 Join via Manual Code | New household member ✅ | Given/When/Then ✅ | Unknown code ✅, rate limit ✅ | Appropriate ✅ | Pass |
| 2.2 Join via Invite Link | New household member ✅ | Given/When/Then ✅ | Invalid code ✅ | Appropriate ✅ | Pass ⚠️ |
| 3.1 Demo Mode Entry | First-time visitor ✅ | Given/When/Then ✅ | None needed (one-tap) ✅ | Appropriate ✅ | Pass |
| 3.2 Demo Exit & Reset | Demo user ✅ | Given/When/Then ✅ | Cron failure non-blocking ✅, bad CRON_SECRET 401 ✅ | Appropriate ✅ | Pass |
| 4.1 Household Menu (Code & Link) | Household member ✅ | Given/When/Then ✅ | N/A (display only) | Appropriate ✅ | Pass |
| 4.2 Household Rename | Household member ✅ | Given/When/Then ✅ | Empty name / cancel reverts ✅ | Appropriate ✅ | Pass |
| 4.3 Device Management & Revocation | Household member ✅ | Given/When/Then ✅ | Revocation error → rollback ✅ | Appropriate ✅ | Pass |
| 4.4 Leave Household | Household member ✅ | Given/When/Then ✅ | Last-member deletion ✅ | Appropriate ✅ | Pass |

---

### Violations Found

#### 🔴 Critical Violations

**None identified.**

---

#### 🟠 Major Issues

**Issue 1: Unspecified edge case — authenticated user accessing `/join/[CODE]`**

- **Story:** 2.2 (Join via Invite Link)
- **AC:** "Given an authenticated user (already has a valid session) opening `/join/[code]` — the page renders normally — it is in `PUBLIC_ROUTES` and passes through regardless of session state."
- **Problem:** The AC specifies the page renders normally, but does NOT specify what happens when an already-authenticated user confirms the join. Can they join a different household? Will their current session be replaced? The PRD is also silent on this case.
- **Risk:** A user with an existing session could accidentally switch households by tapping an old invite link from their messages. The current session gets overwritten with no warning.
- **Recommendation:** Add an AC for this case: either (a) redirect authenticated users to `/home` when they visit `/join/[CODE]` already in a household, or (b) explicitly show a warning "Vous êtes déjà dans un foyer — rejoindre remplacera votre accès actuel."

---

#### 🟡 Minor Concerns

**Concern 1: Story 1.1 uses developer persona, not user persona**
- Story 1.1: "As a developer deploying atable v1.5..."
- This violates user story conventions. In a brownfield project, infrastructure foundation stories with developer personas are pragmatically necessary. Acceptable, but noteworthy.
- **Recommendation:** No action required for a solo developer project. Acceptable pattern.

**Concern 2: `DELETE /api/auth/session` endpoint is implicit**
- Story 3.2 calls `DELETE /api/auth/session` to end the demo session.
- No story explicitly defines this route's implementation. It's implied to be created within Story 3.2.
- **Recommendation:** Add to Story 3.2's ACs: "Given `DELETE /api/auth/session` is called — the `atable_session` cookie is cleared and the response returns 200."

**Concern 3: Story 1.1 is oversized**
- Story 1.1 covers 6+ distinct infrastructure components: DB migration, session utils, join code generator, device name parser, Redis client, type definitions, Zod schemas.
- While tightly coupled (all needed before any auth flow can start), this is a large single story.
- **Recommendation:** No action required. Brownfield foundation stories legitimately bundle coupled prerequisites. The components are all cohesive (auth infrastructure) and cannot be independently shipped.

**Concern 4: NFR timing targets not in story ACs**
- NFR-P3 (household creation < 500ms) and NFR-P4 (join by code < 500ms) are not captured as testable ACs in Stories 1.3 and 2.1.
- **Recommendation:** No action required for implementation — these are operation-level benchmarks, not feature ACs. Can be verified at deployment.

---

### Dependency Analysis Summary

| Story | Backward Dependencies | Forward Dependencies |
|---|---|---|
| 1.1 | None | None |
| 1.2 | 1.1 (session utils) | None |
| 1.3 | 1.1, 1.2 (schema, middleware) | None |
| 2.1 | 1.1, 1.2, 1.3 (schema, session, rate limiter) | None |
| 2.2 | 2.1 (join endpoint exists) | None |
| 3.1 | 1.1 (schema, session) | None |
| 3.2 | 3.1 (demo session) | None |
| 4.1 | 1.1, 1.3 (household created) | None |
| 4.2 | 4.1 (menu exists) | None |
| 4.3 | 4.1, 1.1 (device_sessions table) | None |
| 4.4 | 4.1 (menu exists) | None |

**No forward dependencies found. All dependencies are backward (prior stories in sequence).** ✅

---

### Brownfield Compliance

- ✅ Integration story (1.1) establishes schema migration for existing system
- ✅ Migration story (1.3, J6) handles V1 → V1.5 data continuity
- ✅ Non-regression requirement acknowledged in epics "Additional Requirements" section
- ✅ No greenfield setup stories (no "clone template," no "configure CI/CD from scratch")

---

## Summary and Recommendations

### Overall Readiness Status

## ✅ READY — with 1 recommended fix before implementation starts

The atable v1.5 planning artifacts are in excellent shape. All 27 FRs have 100% epic coverage, all three documents (PRD, UX, Architecture) are well-aligned and mutually referencing, the epic sequencing is dependency-clean, and the acceptance criteria are specific and testable. There are no critical violations and no structural defects that would cause implementation failure.

One **major issue** should be resolved before implementation begins. Four minor concerns can be addressed during implementation with no story changes required.

---

### Issues Requiring Action Before Implementation

#### 🟠 Major — Fix Story 2.2 before implementing Epic 2

**Issue:** Story 2.2 (Join via Invite Link) has an unspecified edge case for authenticated users.

**Current AC:** "Given an authenticated user (already has a valid session) opening `/join/[code]` — the page renders normally."

**Problem:** The AC does not specify what happens when an already-in-a-household user *confirms* the join. `POST /api/households/join` would silently overwrite their existing session with a new household. A household member could accidentally switch households by tapping an old invite link.

**Recommended fix — add to Story 2.2 ACs:**
> **Given** an authenticated user (with a valid `atable_session`) opening `/join/[code]`
> **When** the page renders
> **Then** they see an informational message: *"Vous êtes déjà membre d'un foyer. Rejoindre ce foyer remplacera votre accès actuel."*
> **And** the confirmation CTA is visible but clearly labeled as a household-switch action
>
> *(Alternative simpler approach: redirect already-authenticated users to `/home`, as most cases of an authenticated user hitting `/join/[code]` are link-clicking accidents.)*

**Recommended approach for simplicity:** Redirect authenticated users from `/join/[CODE]` to `/home`. An authenticated member sharing an invite link can just copy it from the household menu — they don't need to use the `/join/` route themselves.

---

### Minor Concerns (Address During Implementation)

| # | Concern | Recommended Action |
|---|---|---|
| M1 | `DELETE /api/auth/session` not explicitly in any story AC | Add to Story 3.2: "Given `DELETE /api/auth/session` is called, the `atable_session` cookie is cleared and response returns 200." |
| M2 | `min-h-dvh` for landing screen (iOS Safari toolbar) | Add as dev note or implementation hint in Story 1.3 |
| M3 | Auto-focus on form inputs not in story ACs | Add to Story 1.3 landing screen ACs or implementation notes |
| M4 | Ghost button variant may not exist in V1 shadcn/ui | Check during Story 1.3 landing screen implementation; add variant if needed |

---

### Recommended Next Steps

1. **Fix Story 2.2:** Add one AC specifying authenticated-user behavior on `/join/[CODE]` — either redirect to `/home` or show an explicit household-switch warning. This prevents a silent session-overwrite bug.

2. **Add `DELETE /api/auth/session` AC to Story 3.2** — 5-minute fix to make the demo exit endpoint explicit rather than implicit.

3. **Proceed to Epic 1, Story 1.1** — the infrastructure story is the critical path blocker. All other stories depend on it. Begin implementation immediately after the Story 2.2 fix is committed to the epics document.

4. **Implement in epic order: 1 → 2 → 3 → 4** — no cross-epic dependencies exist in either direction. Epic 3 (demo) and Epic 4 (management) can technically be developed in parallel after Epic 1 completes, but a solo developer should maintain sequential order.

---

### Final Note

**Assessed:** 2026-03-02 | **Project:** atable v1.5 (Household Auth) | **Documents:** prd-v2.md, architecture-v2.md, epics-v2.md, ux-design-specification-v2.md

This assessment identified **5 issues** across **2 severity levels**:
- 🔴 Critical: **0**
- 🟠 Major: **1** (Story 2.2 edge case — fix before implementation)
- 🟡 Minor: **4** (addressable during implementation)

The planning artifacts demonstrate exceptional quality for a solo developer brownfield project. The PRD is precise and fully numbered, the UX spec is detailed and component-level, the architecture is implementation-ready, and the epics are clean with proper BDD acceptance criteria. The single required fix (Story 2.2 edge case) is minor in scope and can be resolved in under 15 minutes. **Implementation can begin after that fix is applied.**
