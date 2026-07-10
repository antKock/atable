"use client";

import { useEffect } from "react";
import { getDeviceToken } from "@/hooks/useDeviceToken";
import { getPlatform } from "@/lib/native";
import { BUILD_ID } from "@/lib/version";

/**
 * Fire the activity heartbeat on every mount (hard load of an app layout) and
 * on every return to foreground. The resume ping matters on mobile: the
 * Capacitor WebView survives backgrounding, so a user can open the app for
 * days from the recents without ever remounting — mount-only pings recorded
 * cold starts, not active days. Deliberately unguarded: the server already
 * upserts one row per device/day, and a per-day localStorage guard let a
 * demo-session ping consume the day — the real session created right after
 * signup then never pinged, so its platform stayed 'unknown' and day-one
 * activity went unrecorded (spec #4).
 */
function pingActivity() {
  fetch("/api/activity/ping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform: getPlatform(), appVersion: BUILD_ID }),
    keepalive: true,
  }).catch(() => {
    // Heartbeat is best-effort; never surface errors to the user.
  });
}

export default function DeviceTokenProvider() {
  useEffect(() => {
    getDeviceToken();
    pingActivity();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") pingActivity();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return null;
}
