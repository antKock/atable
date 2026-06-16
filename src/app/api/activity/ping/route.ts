import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { withHouseholdAuth } from "@/lib/api/with-household-auth";

// Accepted platform values; anything else is recorded as 'unknown'.
const VALID_PLATFORMS = ["ios", "android", "web"] as const;

/**
 * Activity heartbeat. Called once per app open by the authenticated client.
 * Records today's active-day for the device (idempotent per device/day) and
 * refreshes the session's last_seen_at + platform. Feeds DAU/MAU and the
 * dormant-foyer signal in the usage dashboard.
 */
export const POST = withHouseholdAuth(
  async (request: NextRequest, _ctx, { householdId, sessionId }) => {
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let platform = "unknown";
    let appVersion: string | null = null;
    try {
      const body = await request.json();
      if (
        typeof body?.platform === "string" &&
        (VALID_PLATFORMS as readonly string[]).includes(body.platform)
      ) {
        platform = body.platform;
      }
      // Optional build id (see /lib/version). Capped so a malformed body can't
      // write arbitrarily large strings.
      if (typeof body?.appVersion === "string" && body.appVersion.length <= 64) {
        appVersion = body.appVersion;
      }
    } catch {
      // No / invalid JSON body — platform stays 'unknown', appVersion null.
    }

    const supabase = createServerClient();
    const today = new Date().toISOString().slice(0, 10); // UTC, matches CURRENT_DATE

    // One activity row per device per day; a same-day re-ping refreshes platform.
    await supabase.from("daily_activity").upsert(
      {
        household_id: householdId,
        device_id: sessionId,
        platform,
        app_version: appVersion,
        day: today,
        origin: "ping",
      },
      { onConflict: "device_id,day" },
    );

    await supabase
      .from("device_sessions")
      .update({ last_seen_at: new Date().toISOString(), platform })
      .eq("id", sessionId);

    return NextResponse.json({ ok: true });
  },
);
