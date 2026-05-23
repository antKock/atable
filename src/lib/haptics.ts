import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

/**
 * Run a haptic action only inside the native shell, swallowing any error.
 * On the web this is a no-op, so call sites need no platform checks.
 */
async function run(action: () => Promise<void>): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await action();
  } catch {
    // Haptics may be unavailable on the device — never block the UI.
  }
}

/**
 * Haptic feedback helpers. v1 call sites (see app-store-roadmap.md §7):
 * voice-recording start/stop, successful recipe import, invite-code copy,
 * "delete household" confirmation. Wiring into components is deferred so it
 * does not collide with in-flight UI work.
 */
export const haptics = {
  /** Light tap — small confirmations (e.g. copy a code). */
  light: () => run(() => Haptics.impact({ style: ImpactStyle.Light })),
  /** Medium tap — start/stop of an action (e.g. voice recording). */
  medium: () => run(() => Haptics.impact({ style: ImpactStyle.Medium })),
  /** Heavy tap — destructive confirmations (e.g. delete household). */
  heavy: () => run(() => Haptics.impact({ style: ImpactStyle.Heavy })),
  /** Success notification — e.g. a recipe imported successfully. */
  success: () =>
    run(() => Haptics.notification({ type: NotificationType.Success })),
  /** Warning notification. */
  warning: () =>
    run(() => Haptics.notification({ type: NotificationType.Warning })),
};
