-- Migration 010: demo funnel analytics
--
-- The demo household (is_demo = true) is intentionally EXCLUDED from every
-- real-usage analytics_* function (they all filter is_demo = false). Its
-- activity is, however, a key top-of-funnel signal: how many people try the
-- demo and how engaged they are. We therefore keep logging demo activity in
-- daily_activity and expose it through these dedicated demo_* functions.
--
-- Counterpart to the exclusion in 009 — demo here is is_demo = true only.

-- Top of funnel: new demo trials per day (each demo device_session = one trial).
CREATE OR REPLACE FUNCTION analytics_demo_new_devices(
  p_from date DEFAULT '2000-01-01',
  p_to   date DEFAULT '2999-12-31'
)
RETURNS TABLE (day date, new_devices bigint)
LANGUAGE sql STABLE AS $$
  SELECT s.created_at::date AS day, count(*)
  FROM device_sessions s
  JOIN households h ON h.id = s.household_id
  WHERE h.is_demo = true
    AND s.created_at::date BETWEEN p_from AND p_to
  GROUP BY 1
  ORDER BY 1;
$$;

-- Engagement: distinct devices active on the demo per day (prospective via the
-- heartbeat; historical first-seen days come from the backfill).
CREATE OR REPLACE FUNCTION analytics_demo_dau(
  p_from date DEFAULT '2000-01-01',
  p_to   date DEFAULT '2999-12-31'
)
RETURNS TABLE (day date, devices bigint)
LANGUAGE sql STABLE AS $$
  SELECT d.day, count(DISTINCT d.device_id) AS devices
  FROM daily_activity d
  JOIN households h ON h.id = d.household_id
  WHERE h.is_demo = true
    AND d.device_id IS NOT NULL
    AND d.day BETWEEN p_from AND p_to
  GROUP BY d.day
  ORDER BY d.day;
$$;
