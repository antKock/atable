-- Migration 011: dashboard query functions
--
-- Additive read-only functions feeding the Phase 1 usage dashboard, on top of
-- the 009/010 set. Same conventions: demo households (is_demo) and seed recipes
-- (is_seed) excluded; optional period/platform/household filters.
--
-- Engagement metrics (active_weekly, login_frequency, depth, retention) read
-- daily_activity, which is only fully populated going forward (the heartbeat) —
-- historically it holds backfilled creation/first-seen days, so these are
-- partial until ping data accumulates. Growth/content metrics are reliable now.

-- WAU/MAU per week (active devices on rolling 7d/30d windows) + stickiness.
-- One row per week for the last p_weeks, oldest→newest.
CREATE OR REPLACE FUNCTION analytics_active_weekly(
  p_weeks         int    DEFAULT 26,
  p_platform      text   DEFAULT NULL,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (week date, wau bigint, mau bigint, stickiness numeric)
LANGUAGE sql STABLE AS $$
  SELECT t.week, t.wau, t.mau,
         round(100.0 * t.wau / nullif(t.mau, 0), 1) AS stickiness
  FROM (
    SELECT w.week_end AS week,
      (SELECT count(DISTINCT d.device_id) FROM daily_activity d
         JOIN households h ON h.id = d.household_id
         WHERE h.is_demo = false AND d.device_id IS NOT NULL
           AND d.day BETWEEN w.week_end - 6 AND w.week_end
           AND (p_platform IS NULL OR d.platform = p_platform)
           AND (p_household_ids IS NULL OR d.household_id = ANY(p_household_ids))) AS wau,
      (SELECT count(DISTINCT d.device_id) FROM daily_activity d
         JOIN households h ON h.id = d.household_id
         WHERE h.is_demo = false AND d.device_id IS NOT NULL
           AND d.day BETWEEN w.week_end - 29 AND w.week_end
           AND (p_platform IS NULL OR d.platform = p_platform)
           AND (p_household_ids IS NULL OR d.household_id = ANY(p_household_ids))) AS mau
    FROM (
      SELECT (date_trunc('week', current_date)::date - (g * 7)) AS week_end
      FROM generate_series(0, p_weeks - 1) g
    ) w
  ) t
  ORDER BY t.week;
$$;

-- Login-frequency distribution: number of active days per device over p_days.
CREATE OR REPLACE FUNCTION analytics_login_frequency(
  p_days          int    DEFAULT 30,
  p_platform      text   DEFAULT NULL,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (bin text, devices bigint)
LANGUAGE sql STABLE AS $$
  WITH per_device AS (
    SELECT d.device_id, count(DISTINCT d.day) AS active_days
    FROM daily_activity d
    JOIN households h ON h.id = d.household_id
    WHERE h.is_demo = false AND d.device_id IS NOT NULL
      AND d.day >= current_date - p_days
      AND (p_platform IS NULL OR d.platform = p_platform)
      AND (p_household_ids IS NULL OR d.household_id = ANY(p_household_ids))
    GROUP BY d.device_id
  ),
  binned AS (
    SELECT
      CASE
        WHEN active_days = 1            THEN '1 j'
        WHEN active_days BETWEEN 2 AND 3   THEN '2–3 j'
        WHEN active_days BETWEEN 4 AND 7   THEN '4–7 j'
        WHEN active_days BETWEEN 8 AND 15  THEN '8–15 j'
        ELSE '16+ j'
      END AS bin,
      CASE
        WHEN active_days = 1            THEN 0
        WHEN active_days BETWEEN 2 AND 3   THEN 1
        WHEN active_days BETWEEN 4 AND 7   THEN 2
        WHEN active_days BETWEEN 8 AND 15  THEN 3
        ELSE 4
      END AS ord
    FROM per_device
  )
  SELECT bin, count(*) AS devices
  FROM binned
  GROUP BY bin, ord
  ORDER BY ord;
$$;

-- Cumulative parc (foyers / appareils / recettes) at each week end.
CREATE OR REPLACE FUNCTION analytics_cumulative_parc(p_weeks int DEFAULT 26)
RETURNS TABLE (week date, foyers bigint, appareils bigint, recettes bigint)
LANGUAGE sql STABLE AS $$
  SELECT w.week_end AS week,
    (SELECT count(*) FROM households h
       WHERE h.is_demo = false AND h.created_at::date <= w.week_end),
    (SELECT count(*) FROM device_sessions s
       JOIN households h ON h.id = s.household_id
       WHERE h.is_demo = false AND s.created_at::date <= w.week_end),
    (SELECT count(*) FROM recipes r
       JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND r.is_seed = false AND r.created_at::date <= w.week_end)
  FROM (
    SELECT (date_trunc('week', current_date)::date - (g * 7)) AS week_end
    FROM generate_series(0, p_weeks - 1) g
  ) w
  ORDER BY w.week_end;
$$;

-- Weekly acquisition flux: new devices + new foyers per week (zero-filled grid).
CREATE OR REPLACE FUNCTION analytics_acquisition_weekly(p_weeks int DEFAULT 26)
RETURNS TABLE (week date, devices bigint, foyers bigint)
LANGUAGE sql STABLE AS $$
  SELECT w.wk AS week,
    (SELECT count(*) FROM device_sessions s
       JOIN households h ON h.id = s.household_id
       WHERE h.is_demo = false AND date_trunc('week', s.created_at)::date = w.wk),
    (SELECT count(*) FROM households h
       WHERE h.is_demo = false AND date_trunc('week', h.created_at)::date = w.wk)
  FROM (
    SELECT (date_trunc('week', current_date)::date - (g * 7)) AS wk
    FROM generate_series(0, p_weeks - 1) g
  ) w
  ORDER BY w.wk;
$$;

-- Usage depth: recipes created per active device-day over p_days (scalar).
CREATE OR REPLACE FUNCTION analytics_depth(
  p_days          int    DEFAULT 30,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT round(
    (SELECT count(*)::numeric FROM recipes r
       JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND r.is_seed = false
         AND r.created_at >= current_date - p_days
         AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids)))
    / nullif((
      SELECT count(*) FROM (
        SELECT d.device_id, d.day
        FROM daily_activity d
        JOIN households h ON h.id = d.household_id
        WHERE h.is_demo = false AND d.device_id IS NOT NULL
          AND d.day >= current_date - p_days
          AND (p_household_ids IS NULL OR d.household_id = ANY(p_household_ids))
        GROUP BY d.device_id, d.day
      ) active_device_days
    ), 0)
  , 1);
$$;

-- Add-method mix per month (long format; pivot to % client-side).
CREATE OR REPLACE FUNCTION analytics_source_mix_monthly(
  p_months        int    DEFAULT 9,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (month date, source text, recipes bigint)
LANGUAGE sql STABLE AS $$
  SELECT date_trunc('month', r.created_at)::date AS month, r.source, count(*)
  FROM recipes r
  JOIN households h ON h.id = r.household_id
  WHERE h.is_demo = false AND r.is_seed = false
    AND r.created_at >= date_trunc('month', current_date) - make_interval(months => p_months - 1)
    AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

-- Foyer retention by creation-month cohort: % of the cohort active in each
-- week-offset window after creation (week 0 = creation week).
CREATE OR REPLACE FUNCTION analytics_retention_cohorts(
  p_cohorts  int DEFAULT 3,
  p_max_week int DEFAULT 8
)
RETURNS TABLE (cohort date, week_offset int, households bigint, active bigint, pct numeric)
LANGUAGE sql STABLE AS $$
  WITH coh AS (
    SELECT h.id, date_trunc('month', h.created_at)::date AS cohort, h.created_at
    FROM households h
    WHERE h.is_demo = false
      AND h.created_at >= date_trunc('month', current_date) - make_interval(months => p_cohorts - 1)
  ),
  grid AS (
    SELECT c.id, c.cohort, c.created_at, o.w
    FROM coh c
    CROSS JOIN generate_series(0, p_max_week) o(w)
  )
  SELECT g.cohort, g.w AS week_offset,
    count(*) AS households,
    count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM daily_activity d
      WHERE d.household_id = g.id
        AND d.day >= (g.created_at::date + g.w * 7)
        AND d.day <  (g.created_at::date + (g.w + 1) * 7)
    )) AS active,
    round(100.0 * count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM daily_activity d
      WHERE d.household_id = g.id
        AND d.day >= (g.created_at::date + g.w * 7)
        AND d.day <  (g.created_at::date + (g.w + 1) * 7)
    )) / nullif(count(*), 0), 0) AS pct
  FROM grid g
  GROUP BY g.cohort, g.w
  ORDER BY g.cohort, g.w;
$$;

-- Redefine recipes-per-household distribution with the dashboard's bins
-- (1 / 2–5 / 6–20 / 21–50 / 50+; households with 0 recipes are excluded here).
CREATE OR REPLACE FUNCTION analytics_recipes_per_household_dist(
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (bucket text, households bigint)
LANGUAGE sql STABLE AS $$
  WITH counts AS (
    SELECT h.id, count(r.id) AS n
    FROM households h
    LEFT JOIN recipes r ON r.household_id = h.id AND r.is_seed = false
    WHERE h.is_demo = false
      AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))
    GROUP BY h.id
  ),
  bucketed AS (
    SELECT
      CASE
        WHEN n = 1              THEN '1'
        WHEN n BETWEEN 2 AND 5     THEN '2–5'
        WHEN n BETWEEN 6 AND 20    THEN '6–20'
        WHEN n BETWEEN 21 AND 50   THEN '21–50'
        WHEN n > 50             THEN '50+'
      END AS bucket,
      CASE
        WHEN n = 1              THEN 1
        WHEN n BETWEEN 2 AND 5     THEN 2
        WHEN n BETWEEN 6 AND 20    THEN 3
        WHEN n BETWEEN 21 AND 50   THEN 4
        WHEN n > 50             THEN 5
      END AS ord
    FROM counts
  )
  SELECT bucket, count(*) AS households
  FROM bucketed
  WHERE bucket IS NOT NULL
  GROUP BY bucket, ord
  ORDER BY ord;
$$;
