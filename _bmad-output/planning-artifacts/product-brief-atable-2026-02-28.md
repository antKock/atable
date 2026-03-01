---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: ["brief-recipe-by-claude.md"]
date: 2026-02-28
author: Anthony
---

# Product Brief: atable

## Executive Summary

**atable** is a minimalist, photo-first personal recipe vault designed for households who want to own their culinary collection — not be managed by it. Where existing recipe apps overwhelm with algorithmic suggestions, forced metadata, and visual complexity, atable does one thing beautifully: it stores the recipes *you* chose, makes them easy to find, and handles the boring organization work automatically through AI.

The app is built around visual discovery — large imagery, thematic carousels, zero clutter — so browsing your recipe library feels as natural as scrolling Instagram, with the calm warmth of Airbnb. Recipes are entered with minimal friction (a title, ingredients, steps, and optionally a photo), while AI works asynchronously in the background to tag, categorize, and enrich each recipe with metadata like cooking duration, difficulty, and calorie range.

Success is simple: the app is opened daily at home, new recipes are proactively stored, and the household always knows what to cook next and how to cook it.

---

## Core Vision

### Problem Statement

Home cooks who actively curate their own recipes have no good place to put them. Their collection is fragmented across phone notes, screenshots, bookmarked pages, cookbook photos, and memory — with no consistent way to find a recipe when it matters. Existing recipe apps solve a different problem: they suggest what to cook. atable solves the real one: it remembers what *you* chose.

### Problem Impact

When your recipes live everywhere, you either waste time hunting for them or fall back on the same three dishes you remember by heart. The friction of retrieval kills culinary creativity. A household that can't easily browse their own recipes is a household that doesn't cook as intentionally or as joyfully as it could.

### Why Existing Solutions Fall Short

- **Too opinionated**: they surface their own recipe catalog, not yours
- **Too demanding at entry**: mandatory fields like cooking time create friction that leads to abandoned drafts
- **Visually cluttered**: complex UI designed for discovery platforms, not personal vaults
- **Metadata burden falls on you**: tagging and categorizing is manual, leading to lazy or inconsistent organization over time
- **Photos are assumed**: no graceful fallback for recipes without a good photo

### Proposed Solution

A personal recipe vault with a photo-first visual language (Airbnb-meets-Instagram aesthetic), where:

- Entry is as fast as possible — only the essentials required up front
- AI handles all metadata asynchronously: tags, cooking duration, difficulty, calories — preset without any user effort
- The home screen is a browsable carousel experience organized by AI-generated themes ("Quick meals", "Comfort food", "Light & healthy")
- Photos are central but the app degrades gracefully when photos are missing, with future support for sourcing or generating images automatically
- Sharing works without forcing recipients to create an account — a public link lets anyone view a recipe, and optionally save it to their own library

### Key Differentiators

| Differentiator | What it means |
|---|---|
| **Pure curation** | No algorithmic suggestions — only the recipes you chose |
| **Zero-friction entry** | Minimum required fields; metadata is AI's job, not yours |
| **Async AI enrichment** | Tags, duration, calories pre-filled automatically in the background |
| **Photo-first, photo-resilient** | Beautiful with photos; graceful without; future AI image generation |
| **Frictionless sharing** | Public recipe links require no account; recipients can optionally save to their library |
| **Household-first model** | Starts as shared account; evolves to individual accounts with a shared recipe pool |

---

## Target Users

### Primary Users

#### The Household Curators — Anthony & Marie *(composite persona)*

**Context:** A couple in their 30s, both equally active in the kitchen and in managing their shared recipe library. They cook together on weeknights and do a deliberate Sunday ritual: planning the week's meals before heading to the grocery store.

**Motivations:**
- Cook intentionally, not by default ("what's in the fridge?")
- Build a library that reflects *their* taste, not a platform's algorithm
- Reduce the mental overhead of meal planning

**Current reality (before atable):**
- Recipes scattered across phone Notes, screenshots, bookmarked browser tabs, and physical cookbooks
- Finding a recipe they know they loved means a minor excavation — wrong app, wrong folder, wrong device
- Sunday planning is half improvisation because the collection is too fragmented to browse

**How they use atable:**

| Moment | Behaviour |
|---|---|
| **Sunday planning** | Open app, browse thematic carousels ("Quick meals", "Comfort food"), pick 4–5 recipes for the week, build grocery list from there |
| **Weeknight cooking** | Open app knowing the meal ("pasta from last week"), find it by search or recent — follow the recipe while cooking |
| **Discovery mode** | Know the *type* they want (quick, healthy, indulgent) but not the *which* — browse a carousel until something clicks |
| **Recipe capture** | Just ate something great (restaurant, friend's place, cookbook) — enter it fast, take a photo, let AI handle the tags |

**Success moment:** "I opened the app on Sunday, had 5 meals planned in 10 minutes, and we actually cooked all of them this week."

**What makes them say "this is exactly what I needed":**
- Their whole recipe collection in one beautiful place
- Metadata organized without effort — they never tagged anything, but carousels still work
- Entry is fast enough that they actually do it in the moment

---

### Secondary Users

#### The Dinner Guest — occasional, passive

**Context:** A friend or family member who just ate a great meal at Anthony & Marie's place. The day after, they ask: *"Can you send me that recipe?"* They receive a link, view the recipe on their phone, and that's usually the end of the interaction.

**Needs:**
- View a recipe cleanly on mobile, no account, no friction
- Maybe screenshot it or save the link
- A small subset will be inspired to start their own collection — for them, the path to account creation should be obvious but never forced

**Journey:**
1. Receive a shared link (WhatsApp, SMS, etc.)
2. View the full recipe on a clean, read-only page — photo, ingredients, steps
3. Either screenshot and leave, or tap "Save to my atable" and create an account

---

### User Journey — Core Flow

**From finding a recipe to cooking it (weeknight):**

1. **Trigger:** It's 6pm, time to think about dinner
2. **Open atable** → home screen shows thematic carousels
3. **Browse "Quick meals"** carousel → a photo catches their eye
4. **Open recipe** → full view: photo, ingredients, step-by-step instructions (large text, scroll-friendly)
5. **Cook** with the phone propped up in the kitchen
6. **Done** — no friction, no searching through screenshots

**From experience to library (recipe capture):**

1. **Trigger:** Just ate something great, want to remember it
2. **Open atable** → tap "Add recipe"
3. **Enter fast:** title, ingredients + quantities, steps — photo optional
4. **Submit** → AI enriches asynchronously: tags assigned, duration estimated, calories approximated
5. **Next Sunday:** recipe appears correctly in the right carousel — no tagging needed

---

## Success Metrics

atable is a personal project for a small household — success is felt, not tracked. Formal KPIs would be noise. Instead, we define a small set of **success signals** that indicate the app has genuinely earned a place in daily life.

### What Good Looks Like (6-month horizon)

| Signal | What it means |
|---|---|
| **Weekly opens without prompting** | The app is a reflex, not a conscious choice — someone opens it on Sunday or before cooking without remembering they have to |
| **New recipes are entered proactively** | When a meal works, the instinct is to add it to atable — not screenshot it |
| **Screenshots folder stops growing** | The previous fragmented system is genuinely replaced |
| **Carousels feel meaningful** | Home screen reflects actual cooking moods and patterns; AI tags are accurate enough that browsing by category is useful |
| **Recipe retrieval replaces searching** | Finding a known recipe takes seconds, not a multi-app hunt |

### What Failure Looks Like

- Recipes stop being entered after the first month ("too much effort")
- The app is opened for cooking but not for browsing — it became a lookup tool, not a discovery one
- AI tags are consistently wrong or missing, making carousels useless

---

## MVP Scope

### Core Features (V1)

| Feature | Details |
|---|---|
| **Recipe CRUD** | Create, read, update, delete a recipe |
| **Recipe entry form** | Single-page: title, ingredients + quantities (free text), steps, photo (optional), manual tags |
| **Recipe reading view** | Optimized for kitchen use — large fonts, step-by-step scroll |
| **Home screen carousels** | Thematic carousels driven by manual tags (e.g. "Quick", "Comfort food", "Light") |
| **Basic search** | Search by title, ingredient, or tag |
| **Photo handling** | Optional photo per recipe; graceful fallback UI when missing |
| **Multi-device access** | Web app accessible from any device via shared URL — no login required |
| **Deployment** | Hosted on Vercel (frontend) + cloud-compatible backend/database (e.g. Supabase) — live from V1, accessible from any device |
| **Bot protection** | Rate limiting on API endpoints; app is live on a public URL from V1 — private by obscurity, no auth required, but API endpoints protected against abuse |
| **Language** | French only |

### Out of Scope for V1

| Feature | Deferred to |
|---|---|
| Authentication (accounts, login) | V2 — added once multi-user needs emerge |
| Ingredient catalog + autocomplete | V2 or V3 — free text is sufficient to validate core loop |
| AI async metadata enrichment | V2 or V3 — exact timing confirmed after V1 validation |
| Public recipe sharing via link | V2 |
| OCR / cookbook photo import | V3 |
| Auto prep time, difficulty, calories | V4 |
| Full AI auto-tagging | V5 |
| Serving size adjustment | Future |
| Meal planning | Future |
| Social features | Not planned |

### Known V1 Risk

Carousels in V1 rely entirely on manual tags. Since tagging effort is expected to be low, the home screen discovery experience may feel thin early on. This is an acceptable trade-off for the validation sprint — and the primary signal that AI enrichment should be pulled into V2 sooner rather than later.

### Future Vision

| Version | Theme |
|---|---|
| **V2** | Auth + public sharing + AI async enrichment (TBD) |
| **V3** | OCR import from cookbook/magazine photos |
| **V4** | Auto-calculated prep time, difficulty, calorie range |
| **V5** | Full AI auto-tagging — zero categorization effort |
| **vX** | Household accounts with shared pool, serving size adjustment, AI photo generation |

### MVP Success Gate

V1 is complete when both household members use the app as their **primary recipe store** through at least 4–6 weeks of real cooking. That's the green light for V2.

---

### Version Validation Gate

Each version is validated before the next one begins. V1 is considered successful when the household uses it as their **primary recipe store** for at least 4–6 weeks of real cooking. No feature of V2 is built until V1 earns daily trust.
