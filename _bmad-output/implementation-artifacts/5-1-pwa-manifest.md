# Story 5.1: PWA Manifest

Status: review

## Story

As a user,
I want to add atable to my home screen and have it open in standalone mode like a native app,
So that I can access my recipes without browser chrome.

## Acceptance Criteria

1. **Manifest file** — `public/manifest.json` exists with: `name: "À Table"`, `short_name: "À Table"`, `display: "standalone"`, `start_url: "/home"`, `theme_color: "#F8FAF7"`, `background_color: "#F8FAF7"` (FR40, FR41, FR42).

2. **App icons** — the manifest includes an `icons` array with at least 192×192 and 512×512 PNG icons (maskable + any purpose) (FR42).

3. **Layout link** — `src/app/layout.tsx` includes `<link rel="manifest" href="/manifest.json">` in the document head via Next.js metadata API.

4. **Apple-specific meta** — layout includes `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, and `<link rel="apple-touch-icon" href="/icons/icon-192.png">` for iOS Safari "Add to Home Screen" support.

5. **Standalone mode** — when launched from the home screen on iOS Safari or Android Chrome, the app opens without browser chrome (no URL bar).

## Tasks / Subtasks

- [x] Task 1: Generate PWA icons (AC: #2)
  - [x] Created `public/icons/` directory
  - [x] Generated `icon-192.png` (192×192) — "À" in olive green on warm white, rounded rect
  - [x] Generated `icon-512.png` (512×512) — same design, larger
  - [x] Generated via SVG → sharp PNG conversion

- [x] Task 2: Create `public/manifest.json` (AC: #1, #2)
  - [x] All required fields: name, short_name, display, start_url, theme_color, background_color
  - [x] Icons array with 192×192 and 512×512 (any maskable purpose)
  - [x] orientation: portrait

- [x] Task 3: Update `src/app/layout.tsx` metadata (AC: #3, #4)
  - [x] Added `manifest: "/manifest.json"` to metadata
  - [x] Added `themeColor: "#F8FAF7"`
  - [x] Added `appleWebApp: { capable: true, statusBarStyle: "default", title: "À Table" }`
  - [x] Added `icons: { apple: "/icons/icon-192.png" }`

- [x] Task 4: Verify standalone behavior (AC: #5)
  - [x] Manifest correctly configured for standalone mode
  - [x] Apple-specific meta tags added for iOS Safari
  - [x] Runtime verification requires deployment (deferred to manual test)

## Dev Notes

### Next.js Metadata API for manifest

Next.js 14+ supports `manifest` in the Metadata export directly:
```typescript
export const metadata: Metadata = {
  // ...existing metadata
  manifest: "/manifest.json",
  themeColor: "#F8FAF7",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "À Table",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
}
```

This automatically generates the appropriate `<link>` and `<meta>` tags. Do NOT manually add `<link>` tags to the `<head>` — use the metadata API.

### Current layout.tsx structure

The root layout at `src/app/layout.tsx` already exports a `metadata` object with `metadataBase`, `title`, `description`, `openGraph`, and `twitter`. Add the new fields to this existing object — do NOT create a separate metadata export.

### Icon generation approach

For MVP, create simple PNG icons programmatically or use a minimal design:
- Option A: Create a simple canvas-based icon with "À" letter in olive green (`#6E7A38`) on warm white (`#F8FAF7`) background
- Option B: Use an SVG icon and convert to PNG
- Option C: Use a placeholder solid-color icon with the app initial

The icons should be visually clean and recognizable at small sizes on a phone home screen.

### No service worker in v3

Per architecture doc: "No service worker in v3 MVP scope." Do NOT add a service worker, workbox, or any offline caching. The manifest alone enables "Add to Home Screen" and standalone mode.

### iOS Safari quirks

- iOS Safari requires `apple-mobile-web-app-capable` meta tag for standalone mode
- The `apple-touch-icon` should be 180×180 or larger for best quality
- `status-bar-style: "default"` gives a white status bar matching the warm white theme
- iOS doesn't read `manifest.json` icons — it uses `apple-touch-icon` link instead

### Theme color

`#F8FAF7` (warm white) matches the app's `--background` CSS variable. This colors:
- The browser address bar on Android Chrome
- The status bar area in standalone mode

### Existing i18n

The app name is already defined in `fr.ts` as `t.appName`. The layout already uses it for `title`. Keep using it consistently — but the manifest.json itself must use the literal string "À Table" since it's a static JSON file.

### Project Structure Notes

- New files: `public/manifest.json`, `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Modified files: `src/app/layout.tsx` (add manifest, themeColor, appleWebApp, icons to metadata)
- No new dependencies needed

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1]
- [Source: _bmad-output/planning-artifacts/architecture.md — PWA section]
- [Source: _bmad-output/planning-artifacts/prd.md — FR40, FR41, FR42]
- [Source: src/app/layout.tsx — current metadata export]
- [Source: src/lib/i18n/fr.ts — t.appName]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Created manifest.json with all PWA fields (standalone, portrait, warm white theme)
- Generated 192×192 and 512×512 icons with "À" letter in olive green on warm white
- Updated layout.tsx metadata with manifest, themeColor, appleWebApp, apple-touch-icon
- No service worker added (per architecture: not in v3 scope)
- All 125 tests pass (0 regressions)

### File List

- `public/manifest.json` (new) — PWA web app manifest
- `public/icons/icon-192.png` (new) — 192×192 app icon
- `public/icons/icon-512.png` (new) — 512×512 app icon
- `src/app/layout.tsx` (modified) — added PWA metadata fields

### Change Log

- 2026-03-14: Story 5.1 implementation complete — PWA manifest, icons, metadata
