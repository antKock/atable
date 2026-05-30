-- Migration 012: exclude test households from the dashboard.
--
-- Redefines every real-usage analytics_* function so households whose name
-- starts with "Test" (case-insensitive) are excluded alongside demo households.
-- Mechanically derived from 009 + 011 by replacing the household predicate
--   h.is_demo = false  ->  (h.is_demo = false AND h.name NOT ILIKE 'test%')
-- The demo funnel functions (010, is_demo = true) are intentionally untouched.

CREATE OR REPLACE FUNCTION analytics_kpis(p_household_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  households_total      bigint,
  devices_total         bigint,
  recipes_total         bigint,
  active_households_30d bigint,
  dormant_households    bigint
)
LANGUAGE sql STABLE AS $$
  SELECT
    (SELECT count(*) FROM households h
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%')
         AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))),
    (SELECT count(*) FROM device_sessions s
       JOIN households h ON h.id = s.household_id
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND s.is_revoked = false
         AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))),
    (SELECT count(*) FROM recipes r
       JOIN households h ON h.id = r.household_id
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND r.is_seed = false
         AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))),
    (SELECT count(DISTINCT d.household_id) FROM daily_activity d
       JOIN households h ON h.id = d.household_id
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND d.day >= current_date - 30
         AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))),
    (SELECT count(*) FROM (
        SELECT d.household_id
        FROM daily_activity d
        JOIN households h ON h.id = d.household_id
        WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%')
          AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))
        GROUP BY d.household_id
        HAVING max(d.day) < current_date - 30
     ) dormant);
$$;

-- New households per week.
CREATE OR REPLACE FUNCTION analytics_new_households_weekly(
  p_from date DEFAULT '2000-01-01',
  p_to   date DEFAULT '2999-12-31'
)
RETURNS TABLE (week date, households bigint)
LANGUAGE sql STABLE AS $$
  SELECT date_trunc('week', h.created_at)::date AS week, count(*)
  FROM households h
  WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%')
    AND h.created_at::date BETWEEN p_from AND p_to
  GROUP BY 1
  ORDER BY 1;
$$;

-- Recipes created per day. Platform filter joins the creating device.
CREATE OR REPLACE FUNCTION analytics_recipes_created_daily(
  p_from          date     DEFAULT '2000-01-01',
  p_to            date     DEFAULT '2999-12-31',
  p_household_ids uuid[]   DEFAULT NULL,
  p_source        text     DEFAULT NULL,
  p_platform      text     DEFAULT NULL
)
RETURNS TABLE (day date, recipes bigint)
LANGUAGE sql STABLE AS $$
  SELECT r.created_at::date AS day, count(*)
  FROM recipes r
  JOIN households h ON h.id = r.household_id
  LEFT JOIN device_sessions ds ON ds.id = r.created_by_device_id
  WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND r.is_seed = false
    AND r.created_at::date BETWEEN p_from AND p_to
    AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))
    AND (p_source IS NULL OR r.source = p_source)
    AND (p_platform IS NULL OR COALESCE(ds.platform, 'unknown') = p_platform)
  GROUP BY 1
  ORDER BY 1;
$$;

-- Recipe creations by platform of the creating device (NULL device → unknown).
CREATE OR REPLACE FUNCTION analytics_recipes_by_platform(
  p_from          date   DEFAULT '2000-01-01',
  p_to            date   DEFAULT '2999-12-31',
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (platform text, recipes bigint)
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(ds.platform, 'unknown') AS platform, count(*)
  FROM recipes r
  JOIN households h ON h.id = r.household_id
  LEFT JOIN device_sessions ds ON ds.id = r.created_by_device_id
  WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND r.is_seed = false
    AND r.created_at::date BETWEEN p_from AND p_to
    AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))
  GROUP BY 1
  ORDER BY count(*) DESC;
$$;

-- Distribution of households by recipe count (includes households with 0).
CREATE OR REPLACE FUNCTION analytics_recipes_per_household_dist(
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (bucket text, households bigint)
LANGUAGE sql STABLE AS $$
  WITH counts AS (
    SELECT h.id, count(r.id) AS n
    FROM households h
    LEFT JOIN recipes r ON r.household_id = h.id AND r.is_seed = false
    WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%')
      AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))
    GROUP BY h.id
  ),
  bucketed AS (
    SELECT
      CASE
        WHEN n = 0           THEN '0'
        WHEN n = 1           THEN '1'
        WHEN n BETWEEN 2 AND 5  THEN '2-5'
        WHEN n BETWEEN 6 AND 20 THEN '6-20'
        ELSE '20+'
      END AS bucket,
      CASE
        WHEN n = 0           THEN 0
        WHEN n = 1           THEN 1
        WHEN n BETWEEN 2 AND 5  THEN 2
        WHEN n BETWEEN 6 AND 20 THEN 3
        ELSE 4
      END AS ord
    FROM counts
  )
  SELECT bucket, count(*) AS households
  FROM bucketed
  GROUP BY bucket, ord
  ORDER BY ord;
$$;

-- Distribution of households by number of active (non-revoked) devices.
CREATE OR REPLACE FUNCTION analytics_household_size_dist()
RETURNS TABLE (size int, households bigint)
LANGUAGE sql STABLE AS $$
  WITH sizes AS (
    SELECT h.id, count(s.id) FILTER (WHERE s.is_revoked = false) AS sz
    FROM households h
    LEFT JOIN device_sessions s ON s.household_id = h.id
    WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%')
    GROUP BY h.id
  )
  SELECT sz::int AS size, count(*) AS households
  FROM sizes
  GROUP BY sz
  ORDER BY sz;
$$;

-- Daily active foyers/devices.
CREATE OR REPLACE FUNCTION analytics_dau(
  p_from          date   DEFAULT '2000-01-01',
  p_to            date   DEFAULT '2999-12-31',
  p_platform      text   DEFAULT NULL,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (day date, households bigint, devices bigint)
LANGUAGE sql STABLE AS $$
  SELECT d.day,
         count(DISTINCT d.household_id) AS households,
         count(DISTINCT d.device_id)    AS devices
  FROM daily_activity d
  JOIN households h ON h.id = d.household_id
  WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%')
    AND d.day BETWEEN p_from AND p_to
    AND (p_platform IS NULL OR d.platform = p_platform)
    AND (p_household_ids IS NULL OR d.household_id = ANY(p_household_ids))
  GROUP BY d.day
  ORDER BY d.day;
$$;

-- Monthly active foyers/devices.
CREATE OR REPLACE FUNCTION analytics_mau(
  p_from          date   DEFAULT '2000-01-01',
  p_to            date   DEFAULT '2999-12-31',
  p_platform      text   DEFAULT NULL,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (month date, households bigint, devices bigint)
LANGUAGE sql STABLE AS $$
  SELECT date_trunc('month', d.day)::date AS month,
         count(DISTINCT d.household_id)    AS households,
         count(DISTINCT d.device_id)       AS devices
  FROM daily_activity d
  JOIN households h ON h.id = d.household_id
  WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%')
    AND d.day BETWEEN p_from AND p_to
    AND (p_platform IS NULL OR d.platform = p_platform)
    AND (p_household_ids IS NULL OR d.household_id = ANY(p_household_ids))
  GROUP BY 1
  ORDER BY 1;
$$;

-- Activation by creation-week cohort: share of foyers that added >=1 recipe
-- within 7 days of creation.
CREATE OR REPLACE FUNCTION analytics_activation(
  p_from date DEFAULT '2000-01-01',
  p_to   date DEFAULT '2999-12-31'
)
RETURNS TABLE (cohort_week date, households bigint, activated bigint, rate numeric)
LANGUAGE sql STABLE AS $$
  WITH coh AS (
    SELECT h.id, date_trunc('week', h.created_at)::date AS cohort_week, h.created_at
    FROM households h
    WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%')
      AND h.created_at::date BETWEEN p_from AND p_to
  ),
  act AS (
    SELECT c.cohort_week,
           EXISTS (
             SELECT 1 FROM recipes r
             WHERE r.household_id = c.id AND r.is_seed = false
               AND r.created_at <= c.created_at + interval '7 days'
           ) AS activated
    FROM coh c
  )
  SELECT cohort_week,
         count(*)                                AS households,
         count(*) FILTER (WHERE activated)        AS activated,
         round(100.0 * count(*) FILTER (WHERE activated) / nullif(count(*), 0), 1) AS rate
  FROM act
  GROUP BY cohort_week
  ORDER BY cohort_week;
$$;

-- Enrichment / image pipeline status breakdown (proxy for AI volume & success).
CREATE OR REPLACE FUNCTION analytics_enrichment(p_household_ids uuid[] DEFAULT NULL)
RETURNS TABLE (kind text, status text, recipes bigint)
LANGUAGE sql STABLE AS $$
  SELECT 'enrichment'::text, r.enrichment_status, count(*)
  FROM recipes r
  JOIN households h ON h.id = r.household_id
  WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND r.is_seed = false
    AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))
  GROUP BY r.enrichment_status
  UNION ALL
  SELECT 'image'::text, r.image_status, count(*)
  FROM recipes r
  JOIN households h ON h.id = r.household_id
  WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND r.is_seed = false
    AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))
  GROUP BY r.image_status;
$$;

-- Add-method mix. Platform filter joins the creating device.
CREATE OR REPLACE FUNCTION analytics_source_mix(
  p_from          date   DEFAULT '2000-01-01',
  p_to            date   DEFAULT '2999-12-31',
  p_household_ids uuid[] DEFAULT NULL,
  p_platform      text   DEFAULT NULL
)
RETURNS TABLE (source text, recipes bigint)
LANGUAGE sql STABLE AS $$
  SELECT r.source, count(*)
  FROM recipes r
  JOIN households h ON h.id = r.household_id
  LEFT JOIN device_sessions ds ON ds.id = r.created_by_device_id
  WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND r.is_seed = false
    AND r.created_at::date BETWEEN p_from AND p_to
    AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))
    AND (p_platform IS NULL OR COALESCE(ds.platform, 'unknown') = p_platform)
  GROUP BY r.source
  ORDER BY count(*) DESC;
$$;

-- Top foyers by recipe volume (with last active day).
CREATE OR REPLACE FUNCTION analytics_top_households(p_limit int DEFAULT 10)
RETURNS TABLE (household_id uuid, name text, recipes bigint, last_active date)
LANGUAGE sql STABLE AS $$
  SELECT h.id, h.name,
         count(r.id) FILTER (WHERE r.is_seed = false) AS recipes,
         (SELECT max(d.day) FROM daily_activity d WHERE d.household_id = h.id) AS last_active
  FROM households h
  LEFT JOIN recipes r ON r.household_id = h.id
  WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%')
  GROUP BY h.id, h.name
  ORDER BY recipes DESC, last_active DESC NULLS LAST
  LIMIT p_limit;
$$;

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
         WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND d.device_id IS NOT NULL
           AND d.day BETWEEN w.week_end - 6 AND w.week_end
           AND (p_platform IS NULL OR d.platform = p_platform)
           AND (p_household_ids IS NULL OR d.household_id = ANY(p_household_ids))) AS wau,
      (SELECT count(DISTINCT d.device_id) FROM daily_activity d
         JOIN households h ON h.id = d.household_id
         WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND d.device_id IS NOT NULL
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
    WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND d.device_id IS NOT NULL
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
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND h.created_at::date <= w.week_end),
    (SELECT count(*) FROM device_sessions s
       JOIN households h ON h.id = s.household_id
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND s.created_at::date <= w.week_end),
    (SELECT count(*) FROM recipes r
       JOIN households h ON h.id = r.household_id
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND r.is_seed = false AND r.created_at::date <= w.week_end)
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
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND date_trunc('week', s.created_at)::date = w.wk),
    (SELECT count(*) FROM households h
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND date_trunc('week', h.created_at)::date = w.wk)
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
       WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND r.is_seed = false
         AND r.created_at >= current_date - p_days
         AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids)))
    / nullif((
      SELECT count(*) FROM (
        SELECT d.device_id, d.day
        FROM daily_activity d
        JOIN households h ON h.id = d.household_id
        WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND d.device_id IS NOT NULL
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
  WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%') AND r.is_seed = false
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
    WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%')
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
    WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%')
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
