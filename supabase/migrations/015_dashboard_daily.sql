-- Migration 015: daily-granularity dashboard time series
--
-- The Phase 1 dashboard sampled its trend charts weekly (active_weekly,
-- cumulative_parc, acquisition_weekly). These add daily-resolution variants so
-- the WAU/MAU, parc and acquisition charts plot one point per day instead of
-- one per week. Same conventions as 011/012: demo households (is_demo) and
-- test households (name ILIKE 'test%') and seed recipes (is_seed) are excluded;
-- optional platform/household filters.
--
-- WAU/MAU remain rolling 7d/30d windows — only the sampling cadence changes
-- (one point per day). The weekly functions are kept for backwards compat.

-- WAU/MAU per day (active devices on rolling 7d/30d windows) + stickiness.
-- One row per day for the last p_days, oldest->newest.
CREATE OR REPLACE FUNCTION analytics_active_daily(
  p_days          int    DEFAULT 90,
  p_platform      text   DEFAULT NULL,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (day date, wau bigint, mau bigint, stickiness numeric)
LANGUAGE sql STABLE AS $$
  SELECT t.day, t.wau, t.mau,
         round(100.0 * t.wau / nullif(t.mau, 0), 1) AS stickiness
  FROM (
    SELECT g.d AS day,
      (SELECT count(DISTINCT d.device_id) FROM daily_activity d
         JOIN households h ON h.id = d.household_id
         WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND d.device_id IS NOT NULL
           AND d.day BETWEEN g.d - 6 AND g.d
           AND (p_platform IS NULL OR d.platform = p_platform)
           AND (p_household_ids IS NULL OR d.household_id = ANY(p_household_ids))) AS wau,
      (SELECT count(DISTINCT d.device_id) FROM daily_activity d
         JOIN households h ON h.id = d.household_id
         WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND d.device_id IS NOT NULL
           AND d.day BETWEEN g.d - 29 AND g.d
           AND (p_platform IS NULL OR d.platform = p_platform)
           AND (p_household_ids IS NULL OR d.household_id = ANY(p_household_ids))) AS mau
    FROM (
      SELECT (current_date - g)::date AS d
      FROM generate_series(0, p_days - 1) g
    ) g
  ) t
  ORDER BY t.day;
$$;

-- Cumulative parc (foyers / appareils / recettes) at each day end.
CREATE OR REPLACE FUNCTION analytics_cumulative_parc_daily(p_days int DEFAULT 90)
RETURNS TABLE (day date, foyers bigint, appareils bigint, recettes bigint)
LANGUAGE sql STABLE AS $$
  SELECT g.d AS day,
    (SELECT count(*) FROM households h
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND h.created_at::date <= g.d),
    (SELECT count(*) FROM device_sessions s
       JOIN households h ON h.id = s.household_id
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND s.created_at::date <= g.d),
    (SELECT count(*) FROM recipes r
       JOIN households h ON h.id = r.household_id
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND r.is_seed = false AND r.created_at::date <= g.d)
  FROM (
    SELECT (current_date - g)::date AS d
    FROM generate_series(0, p_days - 1) g
  ) g
  ORDER BY g.d;
$$;

-- Daily acquisition flux: new devices + new foyers per day (zero-filled grid).
CREATE OR REPLACE FUNCTION analytics_acquisition_daily(p_days int DEFAULT 90)
RETURNS TABLE (day date, devices bigint, foyers bigint)
LANGUAGE sql STABLE AS $$
  SELECT g.d AS day,
    (SELECT count(*) FROM device_sessions s
       JOIN households h ON h.id = s.household_id
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND s.created_at::date = g.d),
    (SELECT count(*) FROM households h
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND h.created_at::date = g.d)
  FROM (
    SELECT (current_date - g)::date AS d
    FROM generate_series(0, p_days - 1) g
  ) g
  ORDER BY g.d;
$$;
