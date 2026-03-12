---
title: 'Fix desktop layout overlap issues'
slug: 'fix-desktop-layout-overlap'
created: '2026-03-03'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16', 'Tailwind CSS v4', 'TypeScript']
files_to_modify: ['src/app/(app)/layout.tsx', 'src/components/layout/Navigation.tsx']
code_patterns: ['fixed positioning for nav', 'lg:pl-56 content offset', 'z-50 for overlays']
test_patterns: ['visual verification on mobile and desktop']
---

# Tech-Spec: Fix desktop layout overlap issues

**Created:** 2026-03-03

## Overview

### Problem Statement

On desktop (≥1024px), the DemoBanner is hidden behind the fixed side rail navigation. The banner renders as a top-level sibling outside the `lg:pl-56` content wrapper, so its left portion (0–224px) is obscured by the fixed nav. Additionally, the desktop side rail lacks an explicit z-index, unlike the mobile bottom nav which has `z-50`.

### Solution

Move the DemoBanner inside the `lg:pl-56` content wrapper so it naturally respects the side rail offset on desktop. Add `z-50` to the desktop side rail for consistent stacking.

### Scope

**In Scope:**
- DemoBanner positioning on desktop — move inside `lg:pl-56` div
- Desktop side rail z-index — add `z-50`

**Out of Scope:**
- Mobile layout (working correctly, must not be changed)
- Other component stacking (dialogs, sticky submit — all correct)

## Context for Development

### Codebase Patterns

- Desktop nav: `fixed left-0 top-0 h-full w-56` side rail, hidden below lg
- Mobile nav: `fixed bottom-0 z-50` bottom bar, hidden at lg+
- Content area: wrapped in `div.lg:pl-56` to offset for side rail
- DemoBanner: normal-flow div, no positioning or z-index

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/app/(app)/layout.tsx` | App shell — renders DemoBanner, content wrapper, Navigation |
| `src/components/layout/Navigation.tsx` | Fixed nav — mobile bottom bar + desktop side rail |
| `src/components/demo/DemoBanner.tsx` | Demo mode banner (no changes needed to this file) |

### Technical Decisions

- Move DemoBanner inside `lg:pl-56` div rather than adding padding to the banner itself — cleaner DOM structure
- DemoBanner.tsx needs no changes — only the layout wrapper changes
- z-50 chosen for desktop nav to match mobile nav's existing z-50

## Implementation Plan

### Tasks

- [ ] Task 1: Move DemoBanner inside the content wrapper
  - File: `src/app/(app)/layout.tsx`
  - Action: Move `{isDemo && <DemoBanner />}` from before the `<div className="lg:pl-56">` to inside it, as the first child before `<main>`
  - Notes: This ensures the banner respects `lg:pl-56` on desktop while remaining full-width on mobile (no padding applied below lg)

- [ ] Task 2: Add z-index to desktop side rail
  - File: `src/components/layout/Navigation.tsx`
  - Action: Add `z-50` to the desktop nav's className (line 63), changing `"fixed left-0 top-0 hidden h-full w-56 flex-col border-r border-border bg-surface lg:flex"` to `"fixed left-0 top-0 z-50 hidden h-full w-56 flex-col border-r border-border bg-surface lg:flex"`
  - Notes: Matches mobile nav's z-50 for consistent stacking

### Acceptance Criteria

- [ ] AC 1: Given a demo session on desktop (≥1024px), when the page loads, then the DemoBanner is fully visible in the content area to the right of the side rail
- [ ] AC 2: Given a demo session on mobile (<1024px), when the page loads, then the DemoBanner displays full-width at the top with no visual change from current behavior
- [ ] AC 3: Given the desktop side rail, when inspecting styles, then the nav has z-50 ensuring it renders above scrollable content
- [ ] AC 4: Given any page with dialogs or modals, when opened, then they still render above all other elements (no z-index regression)

## Additional Context

### Dependencies

None — pure CSS/layout fix.

### Testing Strategy

- Manual visual verification on desktop (≥1024px): DemoBanner visible, not hidden behind nav
- Manual visual verification on mobile (<1024px): DemoBanner unchanged, full-width at top
- Verify dialogs (e.g., ConfirmDeleteDialog) still render above nav on both breakpoints

### Notes

- Very low risk change — only moves a JSX element and adds a Tailwind class
- No functional logic changes, no API changes
