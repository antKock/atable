"use client";

import { useEffect } from "react";
import { BUILD_ID } from "@/lib/version";

// How often to ask the server whether a newer deployment is live.
const POLL_MS = 5 * 60 * 1000;

/**
 * Silent self-update for the remote-loaded WebView (and PWA).
 *
 * The native shell loads the live origin directly (capacitor.config.ts
 * server.url), so deployed web changes only reach an already-running app on a
 * full reload — otherwise not until the next cold start. This polls
 * /api/version (and re-checks on every return to foreground); as soon as the
 * live build id differs from the one frozen into this bundle, it reloads to
 * pick up the new version.
 */
export default function VersionWatcher() {
  useEffect(() => {
    // Disabled in dev and when no build id was baked in — avoids reload loops.
    if (process.env.NODE_ENV !== "production") return;
    if (!BUILD_ID || BUILD_ID === "dev") return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (!cancelled && buildId && buildId !== BUILD_ID) {
          window.location.reload();
        }
      } catch {
        // Offline / transient failure — retry on the next tick.
      }
    }

    function onVisibilityChange() {
      if (!document.hidden) check();
    }

    check();
    const intervalId = window.setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
