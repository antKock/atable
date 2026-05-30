-- Migration 008: analytics instrumentation
--
-- Adds the usage-tracking dimensions the dashboard needs and a daily activity
-- log that is the single source of "active days". Historical active-days are
-- backfilled from existing creation timestamps (sections 4a–4c).
--
-- What is recoverable vs. not:
--   - Growth/creation history (households, recipes, first device) is recovered
--     in full below.
--   - The add-method per past recipe and the platform per past session cannot
--     be reconstructed → defaulted to 'unknown'.
--   - Engagement/return frequency at device granularity is mostly prospective
--     (starts accumulating once the heartbeat ships), EXCEPT for single-device
--     households: a household with exactly one device_session (ever) means each
--     of its past recipes was created by that lone device, which was therefore
--     active on the recipe's day — so device-level activity AND recipe→device
--     attribution are recovered retroactively for that subset (see 4c/4d).
--     Foyer-level active-days are partially recovered from 4a/4c.

-- 1. Recipe add-method. Past recipes default to 'unknown'.
--    Expected values going forward: manual | url | photo | voice | unknown.
ALTER TABLE recipes
  ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown';

-- 1b. Creating device. Lets content be segmented by platform/device
--     (recipes-by-platform, method-by-platform, per-device top contributors)
--     by joining device_sessions.platform. Past recipes stay NULL (unknown);
--     this is NOT needed for DAU/MAU (the heartbeat already covers device
--     activity going forward).
ALTER TABLE recipes
  ADD COLUMN created_by_device_id UUID REFERENCES device_sessions(id) ON DELETE SET NULL;

-- 2. Device platform. Captured at ping time going forward → 'unknown' for now.
--    Expected values: ios | android | web | unknown.
ALTER TABLE device_sessions
  ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';

-- 3. Daily activity log — single source of "active days".
--    Filled prospectively by the heartbeat (/api/activity/ping) and seeded
--    below from historical creation timestamps. device_id is NULL for
--    household-level rows (e.g. recipe-derived activity, which has no device).
CREATE TABLE daily_activity (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  device_id    UUID        REFERENCES device_sessions(id) ON DELETE SET NULL,
  platform     TEXT,
  day          DATE        NOT NULL,
  origin       TEXT        NOT NULL DEFAULT 'ping',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per device per day. NULL device_id rows (household-level backfill)
-- are treated as distinct by Postgres, so they never conflict — dedup for
-- those is handled at insert time below.
CREATE UNIQUE INDEX ux_daily_activity_device_day ON daily_activity (device_id, day);
CREATE INDEX idx_daily_activity_household_day    ON daily_activity (household_id, day);
CREATE INDEX idx_daily_activity_day              ON daily_activity (day);

-- All DB access is server-side via the service role (which bypasses RLS).
-- Enable RLS with no policy to deny the public anon key, consistent with 005.
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;

-- 4. Backfill historical active-days (idempotent — guarded so re-running is a
--    no-op).
-- 4a. Household creation day (device unknown).
INSERT INTO daily_activity (household_id, device_id, platform, day, origin)
SELECT h.id, NULL, NULL, h.created_at::date, 'backfill_household'
FROM households h
WHERE NOT EXISTS (
  SELECT 1 FROM daily_activity d
  WHERE d.household_id = h.id
    AND d.day = h.created_at::date
    AND d.origin = 'backfill_household'
);

-- 4b. Device first-seen day (device known).
INSERT INTO daily_activity (household_id, device_id, platform, day, origin)
SELECT s.household_id, s.id, s.platform, s.created_at::date, 'backfill_session'
FROM device_sessions s
ON CONFLICT (device_id, day) DO NOTHING;

-- 4c. Each recipe creation implies its household was active that day. For
--     single-device households we attribute the lone device (recovering
--     device-level activity); multi-device households stay household-level
--     (device unknown, ambiguous). DISTINCT collapses multiple same-day
--     creations; ON CONFLICT skips collisions with the device's first-seen row.
INSERT INTO daily_activity (household_id, device_id, platform, day, origin)
SELECT DISTINCT r.household_id, sd.device_id, sd.platform, r.created_at::date, 'backfill_recipe'
FROM recipes r
LEFT JOIN (
  SELECT s.household_id, s.id AS device_id, s.platform
  FROM device_sessions s
  WHERE s.household_id IN (
    SELECT household_id FROM device_sessions GROUP BY household_id HAVING count(*) = 1
  )
) sd ON sd.household_id = r.household_id
WHERE r.household_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM daily_activity d
    WHERE d.household_id = r.household_id
      AND d.day = r.created_at::date
      AND d.origin = 'backfill_recipe'
  )
ON CONFLICT (device_id, day) DO NOTHING;

-- 4d. Attribute past recipes to the lone device of single-device households,
--     so content can be segmented by device/platform retroactively. Multi-
--     device households stay NULL (ambiguous). Only fills NULLs (idempotent).
UPDATE recipes r
SET created_by_device_id = sd.device_id
FROM (
  SELECT s.household_id, s.id AS device_id
  FROM device_sessions s
  WHERE s.household_id IN (
    SELECT household_id FROM device_sessions GROUP BY household_id HAVING count(*) = 1
  )
) sd
WHERE r.household_id = sd.household_id
  AND r.created_by_device_id IS NULL;
