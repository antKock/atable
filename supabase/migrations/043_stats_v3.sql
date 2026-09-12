-- 043 — Dashboard /admin/stats v3 (backlog #20, docs/specs/stats-v3/00-revue-et-refonte.md).
--
-- Additive (règle « ajouts avant / suppressions après ») : les fonctions v2
-- restent en place et seront retirées par une migration ultérieure une fois
-- la v3 en prod.
--
-- 1. Lot B — usage réel : consultation de recettes datée par personne.
-- 2. Lot B — émission des liens de partage datée.
-- 3. Essais démo par plateforme dans stats_daily (rollup) — tunnel par canal.
-- 4. Journal des digests hebdo (idempotence par semaine ISO).
-- 5. Fonctions v3 : faits par personne, séries hebdo, démo par canal, santé,
--    carnets (explorateur). Le façonnage (cohortes, taux, n/N) est en TS.

-- ============================================================
-- 1. Consultation de recettes : un compteur par personne et par jour.
--    Incrément atomique (INSERT … ON CONFLICT), best-effort côté app
--    (after()). Purge à 13 mois par le cron demo-reset (voir 1b).
-- ============================================================

CREATE TABLE recipe_views_daily (
  owner_id   UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  views      INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, day)
);
ALTER TABLE recipe_views_daily ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION track_recipe_view(p_owner uuid)
RETURNS void
LANGUAGE sql VOLATILE
SET search_path = public
AS $$
  INSERT INTO recipe_views_daily (owner_id, day, views)
  VALUES (p_owner, current_date, 1)
  ON CONFLICT (owner_id, day) DO UPDATE SET views = recipe_views_daily.views + 1;
$$;

-- 1b. Purge des compteurs de plus de 13 mois (appelée par le cron demo-reset).
CREATE OR REPLACE FUNCTION purge_recipe_views(p_keep_days int DEFAULT 400)
RETURNS int
LANGUAGE plpgsql VOLATILE
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  DELETE FROM recipe_views_daily WHERE day < current_date - p_keep_days;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ============================================================
-- 2. Liens de partage datés (avant : share_token sans date → cumul
--    incomparable avec les copies sur 30 j).
-- ============================================================

ALTER TABLE recipes ADD COLUMN share_token_created_at TIMESTAMPTZ;
-- Liens existants : datés de la création de la recette (borne basse honnête,
-- signalée dans les définitions comme « avant le 12 sept. : date approchée »).
UPDATE recipes SET share_token_created_at = created_at WHERE share_token IS NOT NULL;

-- ============================================================
-- 3. Essais démo par plateforme (rollup) — GREATEST comme le reste (032).
-- ============================================================

ALTER TABLE stats_daily
  ADD COLUMN demo_trials_ios     INT NOT NULL DEFAULT 0,
  ADD COLUMN demo_trials_android INT NOT NULL DEFAULT 0,
  ADD COLUMN demo_trials_web     INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION demo_stats_rollup(p_demo_households uuid[], p_days int DEFAULT 30)
RETURNS void
LANGUAGE sql VOLATILE
SET search_path = public
AS $$
  INSERT INTO stats_daily AS s (
    day, demo_trials, demo_trials_ios, demo_trials_android, demo_trials_web,
    demo_active_devices, demo_recipes_added, demo_ai_calls,
    recovery_tokens_sent, recovery_tokens_used,
    merge_tokens_sent, merge_tokens_used, tokens_burned
  )
  SELECT
    g.d,
    (SELECT count(*) FROM device_sessions ds
       WHERE ds.household_id = ANY(p_demo_households) AND ds.created_at::date = g.d
         AND ds.platform <> 'unknown'),
    (SELECT count(*) FROM device_sessions ds
       WHERE ds.household_id = ANY(p_demo_households) AND ds.created_at::date = g.d AND ds.platform = 'ios'),
    (SELECT count(*) FROM device_sessions ds
       WHERE ds.household_id = ANY(p_demo_households) AND ds.created_at::date = g.d AND ds.platform = 'android'),
    (SELECT count(*) FROM device_sessions ds
       WHERE ds.household_id = ANY(p_demo_households) AND ds.created_at::date = g.d AND ds.platform = 'web'),
    (SELECT count(DISTINCT da.device_id) FROM daily_activity da
       WHERE da.household_id = ANY(p_demo_households) AND da.device_id IS NOT NULL AND da.day = g.d),
    (SELECT count(*) FROM recipes r
       WHERE r.household_id = ANY(p_demo_households) AND r.is_seed = false AND r.created_at::date = g.d),
    (SELECT count(*) FROM ai_costs c
       WHERE c.household_id = ANY(p_demo_households) AND c.created_at::date = g.d),
    (SELECT count(*) FROM login_tokens lt
       WHERE lt.purpose = 'recovery' AND lt.created_at::date = g.d),
    (SELECT count(*) FROM login_tokens lt
       WHERE lt.purpose = 'recovery' AND lt.used_at IS NOT NULL AND lt.created_at::date = g.d),
    (SELECT count(*) FROM login_tokens lt
       WHERE lt.purpose = 'merge' AND lt.created_at::date = g.d),
    (SELECT count(*) FROM login_tokens lt
       WHERE lt.purpose = 'merge' AND lt.used_at IS NOT NULL AND lt.created_at::date = g.d),
    (SELECT count(*) FROM login_tokens lt
       WHERE lt.used_at IS NULL AND lt.attempts >= 5 AND lt.created_at::date = g.d)
  FROM (SELECT (current_date - i)::date AS d FROM generate_series(0, LEAST(GREATEST(p_days, 1), 1100) - 1) i) g
  ON CONFLICT (day) DO UPDATE SET
    demo_trials          = GREATEST(s.demo_trials,          EXCLUDED.demo_trials),
    demo_trials_ios      = GREATEST(s.demo_trials_ios,      EXCLUDED.demo_trials_ios),
    demo_trials_android  = GREATEST(s.demo_trials_android,  EXCLUDED.demo_trials_android),
    demo_trials_web      = GREATEST(s.demo_trials_web,      EXCLUDED.demo_trials_web),
    demo_active_devices  = GREATEST(s.demo_active_devices,  EXCLUDED.demo_active_devices),
    demo_recipes_added   = GREATEST(s.demo_recipes_added,   EXCLUDED.demo_recipes_added),
    demo_ai_calls        = GREATEST(s.demo_ai_calls,        EXCLUDED.demo_ai_calls),
    recovery_tokens_sent = GREATEST(s.recovery_tokens_sent, EXCLUDED.recovery_tokens_sent),
    recovery_tokens_used = GREATEST(s.recovery_tokens_used, EXCLUDED.recovery_tokens_used),
    merge_tokens_sent    = GREATEST(s.merge_tokens_sent,    EXCLUDED.merge_tokens_sent),
    merge_tokens_used    = GREATEST(s.merge_tokens_used,    EXCLUDED.merge_tokens_used),
    tokens_burned        = GREATEST(s.tokens_burned,        EXCLUDED.tokens_burned),
    updated_at           = NOW();
$$;

-- ============================================================
-- 4. Digests hebdo envoyés (idempotence par semaine ISO « 2026-W37 »).
-- ============================================================

CREATE TABLE digests_sent (
  week     TEXT PRIMARY KEY,
  sent_to  TEXT NOT NULL,
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE digests_sent ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Fonctions v3
-- ============================================================

-- Recette → personne : l'appareil créateur (100 % renseigné depuis juillet),
-- sinon le premier membre du carnet (recettes d'avant).
CREATE OR REPLACE VIEW v3_recipe_people AS
  SELECT r.id AS recipe_id,
         COALESCE(ds.owner_id, m.owner_id) AS owner_id,
         r.household_id, r.created_at, r.source,
         r.share_token, r.share_token_created_at
  FROM recipes r
  LEFT JOIN device_sessions ds ON ds.id = r.created_by_device_id
  LEFT JOIN LATERAL (
    SELECT mm.owner_id FROM memberships mm
    WHERE mm.household_id = r.household_id AND mm.role = 'member'
    ORDER BY mm.created_at LIMIT 1
  ) m ON ds.owner_id IS NULL
  WHERE r.is_seed = false;

-- 5a. Faits par personne réelle. Fenêtres relatives à l'arrivée (d0) en mois
--     de 28 jours : M1 = J+28→J+55, M2 = J+56→J+83, M3 = J+84→J+111.
--     L'éligibilité (d0 assez ancien) est jugée côté TS avec la date du jour.
CREATE OR REPLACE FUNCTION analytics_v3_people()
RETURNS TABLE (
  id uuid, created_at timestamptz, display_name text,
  has_email boolean, named boolean, via_demo boolean,
  first_platform text, channel text,
  carnets int, guest_of int,
  first_method text, first_recipe_at timestamptz,
  recipes_7d int, recipes_28d int, recipes_total int,
  views_28d int, views_total int,
  returned_7d boolean,
  active_m1 boolean, active_m2 boolean, active_m3 boolean,
  active_28d boolean, active_prev28 boolean,
  active_days_28d int, last_active_day date
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH o AS (
    SELECT o.id, o.created_at, o.created_at::date AS d0,
           COALESCE(o.name, o.alias) AS display_name,
           o.recovery_email IS NOT NULL AS has_email,
           o.name IS NOT NULL AS named,
           o.demo_trial_started_at IS NOT NULL AS via_demo
    FROM owners o WHERE owner_is_real(o.id)
  ),
  fs AS (
    SELECT o.id, (SELECT ds.platform FROM device_sessions ds WHERE ds.owner_id = o.id ORDER BY ds.created_at LIMIT 1) AS first_platform
    FROM o
  ),
  mem AS (
    SELECT o.id,
      (SELECT count(*) FROM memberships m WHERE m.owner_id = o.id AND m.role = 'member')::int AS carnets,
      (SELECT count(*) FROM memberships m WHERE m.owner_id = o.id AND m.role = 'guest')::int AS guest_of,
      -- A rejoint un carnet qui existait déjà avant lui → arrivée par invitation.
      EXISTS (SELECT 1 FROM memberships m JOIN households h ON h.id = m.household_id
              WHERE m.owner_id = o.id AND h.created_at < o.created_at - interval '2 minutes') AS joined_existing
    FROM o
  ),
  fr AS (
    SELECT o.id, rp.source AS first_method, rp.created_at AS first_recipe_at
    FROM o
    LEFT JOIN LATERAL (
      SELECT rp.source, rp.created_at FROM v3_recipe_people rp
      WHERE rp.owner_id = o.id AND rp.created_at >= o.created_at
      ORDER BY rp.created_at LIMIT 1
    ) rp ON true
  ),
  rc AS (
    SELECT o.id,
      (SELECT count(*) FROM v3_recipe_people rp WHERE rp.owner_id = o.id AND rp.created_at >= o.created_at AND rp.created_at < o.created_at + interval '7 days')::int AS recipes_7d,
      (SELECT count(*) FROM v3_recipe_people rp WHERE rp.owner_id = o.id AND rp.created_at::date >= current_date - 27)::int AS recipes_28d,
      (SELECT count(*) FROM v3_recipe_people rp WHERE rp.owner_id = o.id)::int AS recipes_total
    FROM o
  ),
  vw AS (
    SELECT o.id,
      COALESCE((SELECT sum(v.views) FROM recipe_views_daily v WHERE v.owner_id = o.id AND v.day >= current_date - 27), 0)::int AS views_28d,
      COALESCE((SELECT sum(v.views) FROM recipe_views_daily v WHERE v.owner_id = o.id), 0)::int AS views_total
    FROM o
  ),
  act AS (
    SELECT o.id,
      EXISTS (SELECT 1 FROM daily_activity a WHERE a.owner_id = o.id AND a.day BETWEEN o.d0 + 1  AND o.d0 + 7)   AS returned_7d,
      EXISTS (SELECT 1 FROM daily_activity a WHERE a.owner_id = o.id AND a.day BETWEEN o.d0 + 28 AND o.d0 + 55)  AS active_m1,
      EXISTS (SELECT 1 FROM daily_activity a WHERE a.owner_id = o.id AND a.day BETWEEN o.d0 + 56 AND o.d0 + 83)  AS active_m2,
      EXISTS (SELECT 1 FROM daily_activity a WHERE a.owner_id = o.id AND a.day BETWEEN o.d0 + 84 AND o.d0 + 111) AS active_m3,
      EXISTS (SELECT 1 FROM daily_activity a WHERE a.owner_id = o.id AND a.day >= current_date - 27) AS active_28d,
      EXISTS (SELECT 1 FROM daily_activity a WHERE a.owner_id = o.id AND a.day BETWEEN current_date - 55 AND current_date - 28) AS active_prev28,
      (SELECT count(DISTINCT a.day) FROM daily_activity a WHERE a.owner_id = o.id AND a.day >= current_date - 27)::int AS active_days_28d,
      (SELECT max(a.day) FROM daily_activity a WHERE a.owner_id = o.id) AS last_active_day
    FROM o
  )
  SELECT o.id, o.created_at, o.display_name, o.has_email, o.named, o.via_demo,
         fs.first_platform,
         CASE WHEN mem.joined_existing THEN 'invite'
              WHEN fs.first_platform = 'ios' THEN 'ios'
              WHEN fs.first_platform = 'android' THEN 'android'
              ELSE 'web' END AS channel,
         mem.carnets, mem.guest_of,
         fr.first_method, fr.first_recipe_at,
         rc.recipes_7d, rc.recipes_28d, rc.recipes_total,
         vw.views_28d, vw.views_total,
         act.returned_7d, act.active_m1, act.active_m2, act.active_m3,
         act.active_28d, act.active_prev28, act.active_days_28d, act.last_active_day
  FROM o
  JOIN fs  ON fs.id = o.id
  JOIN mem ON mem.id = o.id
  JOIN fr  ON fr.id = o.id
  JOIN rc  ON rc.id = o.id
  JOIN vw  ON vw.id = o.id
  JOIN act ON act.id = o.id
  ORDER BY o.created_at;
$$;

-- 5b. Actifs 28 j par fin de semaine ISO et par mois d'arrivée (layer cake),
--     avec la part « engagée » (≥ 1 recette ajoutée ou consultée sur 28 j).
CREATE OR REPLACE FUNCTION analytics_v3_weekly_active(p_weeks int DEFAULT 12)
RETURNS TABLE (week_end date, cohort_month date, active bigint, engaged bigint)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH weeks AS (
    -- Dimanche de chaque semaine ISO close, la plus récente en dernier.
    SELECT (date_trunc('week', current_date)::date - 1 - 7 * i)::date AS week_end
    FROM generate_series(0, LEAST(GREATEST(p_weeks, 1), 104) - 1) i
  ),
  people AS (
    SELECT o.id, date_trunc('month', o.created_at)::date AS cohort_month
    FROM owners o WHERE owner_is_real(o.id)
  )
  SELECT w.week_end, p.cohort_month,
    count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM daily_activity a WHERE a.owner_id = p.id AND a.day BETWEEN w.week_end - 27 AND w.week_end)) AS active,
    count(*) FILTER (WHERE
      EXISTS (SELECT 1 FROM v3_recipe_people rp WHERE rp.owner_id = p.id AND rp.created_at::date BETWEEN w.week_end - 27 AND w.week_end)
      OR EXISTS (SELECT 1 FROM recipe_views_daily v WHERE v.owner_id = p.id AND v.day BETWEEN w.week_end - 27 AND w.week_end)) AS engaged
  FROM weeks w CROSS JOIN people p
  GROUP BY w.week_end, p.cohort_month
  HAVING count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM daily_activity a WHERE a.owner_id = p.id AND a.day BETWEEN w.week_end - 27 AND w.week_end)) > 0
  ORDER BY w.week_end, p.cohort_month;
$$;

-- 5c. Recettes ajoutées par semaine ISO et par méthode (carnets réels).
CREATE OR REPLACE FUNCTION analytics_v3_weekly_recipes(p_weeks int DEFAULT 12)
RETURNS TABLE (week_start date, source text, recipes bigint)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT date_trunc('week', rp.created_at)::date AS week_start,
         COALESCE(rp.source, 'unknown') AS source,
         count(*) AS recipes
  FROM v3_recipe_people rp
  JOIN households h ON h.id = rp.household_id
  WHERE h.is_demo = false AND h.name NOT ILIKE 'test%'
    AND rp.created_at >= date_trunc('week', current_date)::date - 7 * LEAST(GREATEST(p_weeks, 1), 104)
    AND rp.created_at <  date_trunc('week', current_date)::date
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

-- 5d. Essais démo et conversions par plateforme sur p_days (tunnel par canal).
--     Essais = GREATEST(rollup stats_daily, sessions démo vivantes) par jour,
--     même logique que 041 ; conversions = owners marqués, plateforme de leur
--     première session.
CREATE OR REPLACE FUNCTION analytics_v3_demo(p_days int DEFAULT 28)
RETURNS TABLE (platform text, trials bigint, conversions bigint)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH days AS (
    SELECT (current_date - i)::date AS d FROM generate_series(0, LEAST(GREATEST(p_days, 1), 1100) - 1) i
  ),
  plats AS (SELECT unnest(ARRAY['ios', 'android', 'web']) AS platform),
  live AS (
    SELECT ds.platform, ds.created_at::date AS d, count(*) AS n
    FROM device_sessions ds JOIN households h ON h.id = ds.household_id
    WHERE h.is_demo AND ds.platform IN ('ios', 'android', 'web')
      AND ds.created_at::date >= current_date - LEAST(GREATEST(p_days, 1), 1100) + 1
    GROUP BY 1, 2
  ),
  trials AS (
    SELECT p.platform, sum(GREATEST(
      COALESCE((SELECT CASE p.platform WHEN 'ios' THEN s.demo_trials_ios WHEN 'android' THEN s.demo_trials_android ELSE s.demo_trials_web END
                FROM stats_daily s WHERE s.day = days.d), 0),
      COALESCE((SELECT l.n FROM live l WHERE l.platform = p.platform AND l.d = days.d), 0)
    )) AS trials
    FROM plats p CROSS JOIN days GROUP BY p.platform
  ),
  conv AS (
    SELECT COALESCE((SELECT ds.platform FROM device_sessions ds WHERE ds.owner_id = o.id ORDER BY ds.created_at LIMIT 1), 'web') AS platform,
           count(*) AS conversions
    FROM owners o
    WHERE o.demo_trial_started_at IS NOT NULL AND owner_is_real(o.id)
      AND o.created_at::date >= current_date - LEAST(GREATEST(p_days, 1), 1100) + 1
    GROUP BY 1
  )
  SELECT t.platform, t.trials, COALESCE(c.conversions, 0)
  FROM trials t LEFT JOIN conv c ON c.platform = t.platform
  ORDER BY t.trials DESC;
$$;

-- 5e. Santé (ops) : pipeline, seed démo, derniers passages.
CREATE OR REPLACE FUNCTION analytics_v3_health(p_days int DEFAULT 28)
RETURNS TABLE (
  ai_calls bigint, recipes_created bigint, recipes_enriched bigint, recipes_failed bigint,
  recipes_pending_stale bigint,
  demo_seed_fr bigint, demo_seed_en bigint,
  last_rollup timestamptz, last_app_store_sync timestamptz,
  ai_cost_usd numeric, ai_cost_demo_usd numeric,
  demo_trials bigint, demo_frozen_hits bigint, demo_ai_calls bigint, demo_recipes bigint,
  recovery_sent bigint, recovery_used bigint, merge_used bigint, tokens_burned bigint
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH demo AS (SELECT id FROM households WHERE is_demo ORDER BY created_at),
       window_ AS (SELECT (current_date - LEAST(GREATEST(p_days, 1), 1100) + 1)::date AS since)
  SELECT
    (SELECT count(*) FROM ai_costs c, window_ w WHERE c.created_at::date >= w.since AND (c.household_id IS NULL OR c.household_id NOT IN (SELECT id FROM demo))),
    (SELECT count(*) FROM recipes r JOIN households h ON h.id = r.household_id, window_ w
       WHERE h.is_demo = false AND r.is_seed = false AND r.created_at::date >= w.since),
    (SELECT count(*) FROM recipes r JOIN households h ON h.id = r.household_id, window_ w
       WHERE h.is_demo = false AND r.is_seed = false AND r.created_at::date >= w.since
         AND r.enrichment_status = 'enriched' AND r.image_status <> 'failed'),
    (SELECT count(*) FROM recipes r JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND r.is_seed = false AND (r.enrichment_status = 'failed' OR r.image_status = 'failed')),
    (SELECT count(*) FROM recipes r JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND r.is_seed = false AND r.enrichment_status IN ('pending', 'processing') AND r.created_at < now() - interval '1 hour'),
    (SELECT count(*) FROM recipes r WHERE r.is_seed AND r.household_id = (SELECT id FROM demo LIMIT 1)),
    (SELECT count(*) FROM recipes r WHERE r.is_seed AND r.household_id = (SELECT id FROM demo OFFSET 1 LIMIT 1)),
    (SELECT max(updated_at) FROM stats_daily),
    (SELECT max(synced_at) FROM app_store_sync_instances),
    (SELECT COALESCE(round(sum(c.cost_usd)::numeric, 2), 0) FROM ai_costs c, window_ w WHERE c.created_at::date >= w.since AND (c.household_id IS NULL OR c.household_id NOT IN (SELECT id FROM demo))),
    (SELECT COALESCE(round(sum(c.cost_usd)::numeric, 2), 0) FROM ai_costs c, window_ w WHERE c.created_at::date >= w.since AND c.household_id IN (SELECT id FROM demo)),
    (SELECT COALESCE(sum(s.demo_trials), 0) FROM stats_daily s, window_ w WHERE s.day >= w.since),
    (SELECT COALESCE(sum(s.demo_frozen_hits), 0) FROM stats_daily s, window_ w WHERE s.day >= w.since),
    (SELECT COALESCE(sum(s.demo_ai_calls), 0) FROM stats_daily s, window_ w WHERE s.day >= w.since),
    (SELECT COALESCE(sum(s.demo_recipes_added), 0) FROM stats_daily s, window_ w WHERE s.day >= w.since),
    (SELECT COALESCE(sum(s.recovery_tokens_sent), 0) FROM stats_daily s, window_ w WHERE s.day >= w.since),
    (SELECT COALESCE(sum(s.recovery_tokens_used), 0) FROM stats_daily s, window_ w WHERE s.day >= w.since),
    (SELECT COALESCE(sum(s.merge_tokens_used), 0) FROM stats_daily s, window_ w WHERE s.day >= w.since),
    (SELECT COALESCE(sum(s.tokens_burned), 0) FROM stats_daily s, window_ w WHERE s.day >= w.since);
$$;

-- 5f. Carnets réels (explorateur) : composition, contenu, dernière activité.
CREATE OR REPLACE FUNCTION analytics_v3_carnets()
RETURNS TABLE (
  id uuid, name text, created_at timestamptz, origin text,
  members int, guests int, recipes int, shared_links int, last_active_day date
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT h.id, h.name, h.created_at, h.origin,
    (SELECT count(*) FROM memberships m WHERE m.household_id = h.id AND m.role = 'member')::int,
    (SELECT count(*) FROM memberships m WHERE m.household_id = h.id AND m.role = 'guest')::int,
    (SELECT count(*) FROM recipes r WHERE r.household_id = h.id AND r.is_seed = false)::int,
    (SELECT count(*) FROM recipes r WHERE r.household_id = h.id AND r.share_token IS NOT NULL)::int,
    (SELECT max(a.day) FROM daily_activity a JOIN memberships m ON m.owner_id = a.owner_id
       WHERE m.household_id = h.id)
  FROM households h
  WHERE h.is_demo = false AND h.name NOT ILIKE 'test%'
  ORDER BY h.created_at DESC;
$$;

-- 5g. Partage : liens émis (datés) et copies sur p_days, arrivées par lien.
CREATE OR REPLACE FUNCTION analytics_v3_sharing(p_days int DEFAULT 84)
RETURNS TABLE (links bigint, links_dated_estimate boolean, copies bigint)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM recipes r JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND r.share_token IS NOT NULL
         AND r.share_token_created_at >= current_date - LEAST(GREATEST(p_days, 1), 1100) + 1),
    -- Vrai tant que des liens d'avant la 043 (date approchée) tombent dans la fenêtre.
    EXISTS (SELECT 1 FROM recipes r WHERE r.share_token IS NOT NULL AND r.share_token_created_at = r.created_at
              AND r.created_at < '2026-09-13' AND r.share_token_created_at >= current_date - LEAST(GREATEST(p_days, 1), 1100) + 1),
    (SELECT count(*) FROM recipes r JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND r.is_seed = false AND r.source = 'shared'
         AND r.created_at >= current_date - LEAST(GREATEST(p_days, 1), 1100) + 1);
$$;

-- Privilèges : réservés à service_role (règle 039).
REVOKE ALL ON FUNCTION track_recipe_view(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION purge_recipe_views(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION demo_stats_rollup(uuid[], int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_v3_people() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_v3_weekly_active(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_v3_weekly_recipes(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_v3_demo(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_v3_health(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_v3_carnets() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_v3_sharing(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON v3_recipe_people FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION track_recipe_view(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION purge_recipe_views(int) TO service_role;
GRANT EXECUTE ON FUNCTION demo_stats_rollup(uuid[], int) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_v3_people() TO service_role;
GRANT EXECUTE ON FUNCTION analytics_v3_weekly_active(int) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_v3_weekly_recipes(int) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_v3_demo(int) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_v3_health(int) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_v3_carnets() TO service_role;
GRANT EXECUTE ON FUNCTION analytics_v3_sharing(int) TO service_role;
GRANT SELECT ON v3_recipe_people TO service_role;
