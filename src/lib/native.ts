import { Capacitor } from "@capacitor/core";

/**
 * True when the app runs inside the native Capacitor shell (iOS), false in a
 * regular web browser.
 *
 * Checks Capacitor's own bridge first, then falls back to the custom
 * user-agent (`MijoteNative/…`) and the `?native=1` URL flag that the native
 * shell appends to `server.url` — see capacitor.config.ts.
 */
export function isNativeApp(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    // Capacitor bridge not loaded yet — fall through to the heuristics.
  }

  if (
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("MijoteNative")
  ) {
    return true;
  }

  if (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("native")
  ) {
    return true;
  }

  return false;
}
