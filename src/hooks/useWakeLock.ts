import { useEffect, useRef } from "react";

export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          const sentinel = await navigator.wakeLock.request("screen");
          if (cancelled) {
            sentinel.release().catch(() => {});
            return;
          }
          wakeLockRef.current = sentinel;
        }
      } catch {
        // Silent fallback — NFR-R4: Wake Lock API failure produces no visible error
      }
    }

    // The OS releases the sentinel whenever the app goes to background (user
    // answers a message mid-cooking…) — re-acquire it on return to foreground,
    // otherwise the screen dims again for the rest of the recipe.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    }

    requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);
}
