"use client";

import { useEffect } from "react";
import { getDeviceToken } from "@/hooks/useDeviceToken";
import { getPlatform } from "@/lib/native";

const PING_GUARD_KEY = "mijote_activity_pinged_on";

/**
 * Fire the activity heartbeat at most once per UTC day. The guard avoids
 * re-pinging on every navigation (this provider mounts in both app layouts).
 */
function pingActivityOncePerDay() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(PING_GUARD_KEY) === today) return;
  } catch {
    // localStorage unavailable — fall through and ping anyway.
  }

  fetch("/api/activity/ping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform: getPlatform() }),
    keepalive: true,
  })
    .then((res) => {
      if (res.ok) {
        try {
          localStorage.setItem(PING_GUARD_KEY, today);
        } catch {
          // best-effort guard
        }
      }
    })
    .catch(() => {
      // Heartbeat is best-effort; never surface errors to the user.
    });
}

export default function DeviceTokenProvider() {
  useEffect(() => {
    getDeviceToken();
    pingActivityOncePerDay();
  }, []);

  return null;
}
