import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

/**
 * Hide the native Capacitor splash screen. No-op on the web.
 *
 * Without this call the splash sits for the full `launchShowDuration`
 * configured in capacitor.config.ts (1500ms today), even when React has
 * already mounted and the WebView could paint. Calling this from a root
 * useEffect collapses the delay to "as soon as React is ready".
 */
export async function hideNativeSplash(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SplashScreen.hide();
  } catch {
    // SplashScreen plugin may be unavailable on a given device — never
    // block the UI; Capacitor's launchAutoHide is the safety net.
  }
}
