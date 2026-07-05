/**
 * One-off backfill (spec #4): a day where a session created a recipe is an
 * active day for that device — but until the heartbeat guard fix (commit
 * 5773779) the ping could be silently swallowed (demo session consumed the
 * once-per-day localStorage guard), so daily_activity is missing those days.
 *
 * Inserts the missing (device_id, day) rows from recipes.created_by_device_id
 * + created_at (UTC day, matching the ping's CURRENT_DATE). Platform comes
 * from the session (a session is bound to one device, so its platform holds
 * for all its days; never-pinged sessions stay 'unknown'). Idempotent: the
 * ux_daily_activity_device_day unique index makes re-runs no-ops.
 *
 * Env (source the right file BEFORE running):
 *   staging:  set -a; . ./.env.staging.local; set +a
 *   prod:     set -a; . ./.env.local;         set +a
 * Then:  node scripts/backfill-activity-from-recipe-days.mjs [--dry]
 *   --dry  → report only, no inserts.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key);
const DRY = process.argv.includes("--dry");
const ref = url.match(/https:\/\/([^.]+)/)?.[1];
console.log(`Project ${ref} — ${DRY ? "DRY RUN" : "LIVE"}`);

const { data: recipes, error: rErr } = await supabase
  .from("recipes")
  .select("household_id, created_by_device_id, created_at")
  .not("created_by_device_id", "is", null);
if (rErr) {
  console.error(rErr.message);
  process.exit(1);
}

const deviceIds = [...new Set(recipes.map((r) => r.created_by_device_id))];
const { data: sessions, error: sErr } = await supabase
  .from("device_sessions")
  .select("id, platform")
  .in("id", deviceIds);
if (sErr) {
  console.error(sErr.message);
  process.exit(1);
}
const platformOf = Object.fromEntries(sessions.map((s) => [s.id, s.platform]));

// One candidate row per (device, UTC day); multiple same-day recipes collapse.
const candidates = new Map();
for (const r of recipes) {
  const day = r.created_at.slice(0, 10);
  candidates.set(`${r.created_by_device_id}|${day}`, {
    household_id: r.household_id,
    device_id: r.created_by_device_id,
    platform: platformOf[r.created_by_device_id] ?? "unknown",
    day,
    origin: "backfill_recipe",
  });
}

// Report which candidates are actually missing before touching anything.
const { data: existing, error: eErr } = await supabase
  .from("daily_activity")
  .select("device_id, day")
  .in("device_id", deviceIds);
if (eErr) {
  console.error(eErr.message);
  process.exit(1);
}
const already = new Set(existing.map((e) => `${e.device_id}|${e.day}`));
const missing = [...candidates.entries()].filter(([k]) => !already.has(k)).map(([, v]) => v);

console.log(
  `${recipes.length} attributed recipes → ${candidates.size} device-days, ` +
    `${missing.length} missing from daily_activity`,
);
for (const m of missing) {
  console.log(`  + ${m.day} ${m.platform.padEnd(7)} device=${m.device_id} hh=${m.household_id}`);
}

if (DRY || missing.length === 0) {
  console.log(DRY ? "Dry run — nothing written." : "Nothing to do.");
  process.exit(0);
}

// ignoreDuplicates → INSERT ... ON CONFLICT (device_id, day) DO NOTHING, so a
// ping that lands between the report and this write can't be clobbered.
const { error: iErr } = await supabase
  .from("daily_activity")
  .upsert(missing, { onConflict: "device_id,day", ignoreDuplicates: true });
if (iErr) {
  console.error(iErr.message);
  process.exit(1);
}
console.log(`Inserted ${missing.length} rows.`);
