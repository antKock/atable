import type { CapacitorConfig } from "@capacitor/cli";

// À Table runs as a Capacitor shell whose WebView loads the live Vercel
// origin directly (first-party) — see docs/app-store-roadmap.md §1.
//
// TODO (Phase 0.5): Debug/TestFlight builds should point server.url at
// https://staging.atable.anthonykocken.fr once the staging env exists.
const config: CapacitorConfig = {
  appId: "fr.anthonykocken.atable",
  appName: "À Table",
  // Required by Capacitor even when loading a remote server.url; holds the
  // bundled fallback assets. TODO (Phase 3): point at an offline fallback page.
  webDir: "public",
  server: {
    // first-party origin + ?native=1 so the server can detect the native shell
    url: "https://atable.anthonykocken.fr?native=1",
    cleartext: false,
  },
  ios: {
    // Lets middleware.ts recognise the native shell. Must NOT contain any
    // BOT_UA_PATTERN token (WhatsApp, Facebot, …) or it would bypass auth.
    appendUserAgent: "ATableNative/1.0",
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
