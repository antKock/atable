import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";

// Accepted platform values; anything else is recorded as 'unknown'.
const VALID_PLATFORMS = ["ios", "android", "web"] as const;

/**
 * Activity heartbeat. Called once per app open by the authenticated client.
 * Records today's active-day for the device (idempotent per device/day) and
 * refreshes the session's last_seen_at + platform. Feeds DAU/MAU and the
 * dormant-foyer signal in the usage dashboard.
 */
export async function POST(request: NextRequest) {
  const hdrs = await headers();
  const householdId = hdrs.get("x-household-id");
  const sessionId = hdrs.get("x-session-id");

  if (!householdId || !sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let platform = "unknown";
  try {
    const body = await request.json();
    if (
      typeof body?.platform === "string" &&
      (VALID_PLATFORMS as readonly string[]).includes(body.platform)
    ) {
      platform = body.platform;
    }
  } catch {
    // No / invalid JSON body — platform stays 'unknown'.
  }

  const supabase = createServerClient();
  const today = new Date().toISOString().slice(0, 10); // UTC, matches CURRENT_DATE

  // One activity row per device per day; a same-day re-ping refreshes platform.
  await supabase.from("daily_activity").upsert(
    {
      household_id: householdId,
      device_id: sessionId,
      platform,
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
}
