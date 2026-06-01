import { isNativeApp } from "@/lib/native";

// Asks for an App Store rating once the user has added their 3rd recipe, and
// only ever once. Native-only (no-op on web); Apple additionally throttles and
// may decline to show the dialog — we just make the single request.
const COUNT_KEY = "mijote_recipe_add_count";
const DONE_KEY = "mijote_review_requested";
const THRESHOLD = 3;

export async function maybeRequestReview(): Promise<void> {
  if (typeof window === "undefined" || !isNativeApp()) return;
  if (localStorage.getItem(DONE_KEY)) return;

  const next = (parseInt(localStorage.getItem(COUNT_KEY) ?? "0", 10) || 0) + 1;
  localStorage.setItem(COUNT_KEY, String(next));
  if (next < THRESHOLD) return;

  try {
    const { InAppReview } = await import("@capacitor-community/in-app-review");
    await InAppReview.requestReview();
    localStorage.setItem(DONE_KEY, "1");
  } catch {
    // Plugin unavailable or request failed — leave DONE unset so a later add
    // can retry once the native build ships the plugin.
  }
}
