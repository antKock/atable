-- 044 — Stats v3 : série quotidienne « chaude » (bloc 0 « 7 derniers jours ») et
-- ouvertures iOS par jour pour le funnel App Store hebdo.
--
-- Une ligne par jour : essais démo (total et par plateforme, GREATEST rollup /
-- sessions vivantes comme 041/043), nouvelles personnes réelles, recettes
-- ajoutées (carnets réels), personnes actives dans la journée (grain owner).

CREATE OR REPLACE FUNCTION analytics_v3_daily(p_days int DEFAULT 28)
RETURNS TABLE (
  day date, trials bigint, trials_ios bigint, trials_web bigint, trials_android bigint,
  new_people bigint, recipes bigint, active_people bigint
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH days AS (
    SELECT (current_date - i)::date AS d FROM generate_series(0, LEAST(GREATEST(p_days, 1), 1100) - 1) i
  ),
  live AS (
    SELECT ds.created_at::date AS d,
           count(*) FILTER (WHERE ds.platform <> 'unknown') AS n,
           count(*) FILTER (WHERE ds.platform = 'ios') AS n_ios,
           count(*) FILTER (WHERE ds.platform = 'web') AS n_web,
           count(*) FILTER (WHERE ds.platform = 'android') AS n_android
    FROM device_sessions ds JOIN households h ON h.id = ds.household_id
    WHERE h.is_demo AND ds.created_at::date >= current_date - LEAST(GREATEST(p_days, 1), 1100) + 1
    GROUP BY 1
  )
  SELECT days.d,
    GREATEST(COALESCE((SELECT s.demo_trials FROM stats_daily s WHERE s.day = days.d), 0), COALESCE((SELECT l.n FROM live l WHERE l.d = days.d), 0)),
    GREATEST(COALESCE((SELECT s.demo_trials_ios FROM stats_daily s WHERE s.day = days.d), 0), COALESCE((SELECT l.n_ios FROM live l WHERE l.d = days.d), 0)),
    GREATEST(COALESCE((SELECT s.demo_trials_web FROM stats_daily s WHERE s.day = days.d), 0), COALESCE((SELECT l.n_web FROM live l WHERE l.d = days.d), 0)),
    GREATEST(COALESCE((SELECT s.demo_trials_android FROM stats_daily s WHERE s.day = days.d), 0), COALESCE((SELECT l.n_android FROM live l WHERE l.d = days.d), 0)),
    (SELECT count(*) FROM owners o WHERE owner_is_real(o.id) AND o.created_at::date = days.d),
    (SELECT count(*) FROM recipes r JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND r.is_seed = false AND r.created_at::date = days.d),
    (SELECT count(DISTINCT a.owner_id) FROM daily_activity a
       WHERE a.owner_id IS NOT NULL AND a.day = days.d AND owner_is_real(a.owner_id))
  FROM days
  ORDER BY days.d;
$$;

REVOKE ALL ON FUNCTION analytics_v3_daily(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics_v3_daily(int) TO service_role;
