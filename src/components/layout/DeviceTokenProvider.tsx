"use client";

import { useEffect } from "react";
import { getDeviceToken } from "@/hooks/useDeviceToken";
import { getPlatform } from "@/lib/native";
import { BUILD_ID } from "@/lib/version";

/**
 * Fire the activity heartbeat on every mount, i.e. once per hard load of an
 * app layout. Deliberately unguarded: the server already upserts one row per
 * device/day, and a per-day localStorage guard let a demo-session ping consume
 * the day — the real session created right after signup then never pinged, so
 * its platform stayed 'unknown' and day-one activity went unrecorded (spec #4).
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
  }, []);

  return null;
}
