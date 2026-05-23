import type { CapacitorConfig } from "@capacitor/cli";

// Mijote runs as a Capacitor shell whose WebView loads the live Vercel
// origin directly (first-party) — see docs/app-store-roadmap.md §1.
//
// server.url is environment-driven, resolved at `cap sync` time:
//   - Debug / TestFlight build : `CAP_ENV=staging npx cap sync ios`
//       → loads https://staging.mijote.anthonykocken.fr
//   - Release / App Store build: plain `npx cap sync ios`
//       → loads https://mijote.anthonykocken.fr  (default — the safe default)
const PROD_URL = "https://mijote.anthonykocken.fr";
const STAGING_URL = "https://staging.mijote.anthonykocken.fr";
const serverUrl = process.env.CAP_ENV === "staging" ? STAGING_URL : PROD_URL;

const config: CapacitorConfig = {
  appId: "fr.anthonykocken.mijote",
  appName: "Mijote",
  // Required by Capacitor even when loading a remote server.url; holds the
  // bundled fallback assets (incl. public/offline.html, served by Capacitor
  // via server.errorPath below when the remote URL is unreachable).
  webDir: "public",
  server: {
    // First-party origin, loaded directly in the WebView. Must be a clean
    // origin AND listed in allowNavigation, otherwise Capacitor treats it as
    // external and opens it in Safari instead of the in-app WebView.
    // Native detection is done server-side via the MijoteNative user-agent.
    url: serverUrl,
    // Both origins whitelisted so navigation stays in-app whichever
    // environment server.url resolves to.
    allowNavigation: ["mijote.anthonykocken.fr", "staging.mijote.anthonykocken.fr"],
    cleartext: false,
    // Path (relative to webDir = "public") to the local HTML page served by
    // Capacitor when the remote server.url is unreachable at launch.
    // This is Capacitor's supported escape hatch for offline-at-launch when
    // using remote loading. See discussion #7978 and issue #8302 in
    // ionic-team/capacitor.
    errorPath: "offline.html",
  },
  ios: {
    // Lets middleware.ts recognise the native shell. Must NOT contain any
    // BOT_UA_PATTERN token (WhatsApp, Facebot, …) or it would bypass auth.
    appendUserAgent: "MijoteNative/1.0",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#F8FAF7",
      showSpinner: false,
    },
  },
};

export default config;
