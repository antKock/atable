-- 048 — Sondes exclues des stats (backlog #26).
--
-- Une « sonde » = un appareil d'Anthony ou un agent (curl, Playwright) qui
-- teste la prod. Marqueur explicite posé à la création (cookie `mijote_probe`
-- ou en-tête `x-mijote-probe`, traduit par le proxy en `x-probe`) :
--   - owners.is_probe      → owner_is_real() faux : personnes, cohortes, activation,
--                            A/B par bras, conversions démo, actifs ;
--   - households.is_probe  → traité comme un foyer `test%` : carnets, recettes
--                            (vue v3_recipe_people, série quotidienne, pipeline).
-- Les sessions démo d'une sonde n'ont jamais de ping (route ping court-circuitée)
-- → plateforme `unknown` → déjà exclues des essais démo (041) et de l'activité.
-- Les coûts IA restent comptés dans la dépense (argent réel), décision Anthony.
--
-- Corps recopiés de 033 (owner_is_real), 043 (vue, carnets, health) et 044
-- (daily) avec le seul ajout du filtre. Signatures inchangées.

ALTER TABLE owners     ADD COLUMN IF NOT EXISTS is_probe boolean NOT NULL DEFAULT false;
ALTER TABLE households ADD COLUMN IF NOT EXISTS is_probe boolean NOT NULL DEFAULT false;

-- 1. owner_is_real : ni démo, ni foyer test, ni sonde (owner ou foyer).
CREATE OR REPLACE FUNCTION owner_is_real(p_owner uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM owners o WHERE o.id = p_owner AND o.is_probe)
  AND EXISTS (
    SELECT 1 FROM memberships m
    JOIN households h ON h.id = m.household_id
    WHERE m.owner_id = p_owner AND h.is_demo = false AND h.name NOT ILIKE 'test%' AND h.is_probe = false)
  AND NOT EXISTS (
    SELECT 1 FROM memberships m
    JOIN households h ON h.id = m.household_id
    WHERE m.owner_id = p_owner AND (h.is_demo OR h.name ILIKE 'test%' OR h.is_probe));
$$;

-- 2. Recette → personne : hors foyers sondes (sert people, weekly_recipes, sharing).
CREATE OR REPLACE VIEW v3_recipe_people AS
  SELECT r.id AS recipe_id,
         COALESCE(ds.owner_id, m.owner_id) AS owner_id,
         r.household_id, r.created_at, r.source,
         r.share_token, r.share_token_created_at
  FROM recipes r
  JOIN households h ON h.id = r.household_id AND h.is_probe = false
  LEFT JOIN device_sessions ds ON ds.id = r.created_by_device_id
  LEFT JOIN LATERAL (
    SELECT mm.owner_id FROM memberships mm
    WHERE mm.household_id = r.household_id AND mm.role = 'member'
    ORDER BY mm.created_at LIMIT 1
  ) m ON ds.owner_id IS NULL
  WHERE r.is_seed = false;

-- 3. Carnets réels (explorateur).
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
  WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND h.is_probe = false
  ORDER BY h.created_at DESC;
$$;

-- 4. Série quotidienne (044) : recettes hors foyers sondes.
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
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND h.is_probe = false AND r.is_seed = false AND r.created_at::date = days.d),
    (SELECT count(DISTINCT a.owner_id) FROM daily_activity a
       WHERE a.owner_id IS NOT NULL AND a.day = days.d AND owner_is_real(a.owner_id))
  FROM days
  ORDER BY days.d;
$$;

-- 5. Santé (043 §5e) : pipeline hors foyers sondes ; coûts IA inchangés.
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
       WHERE h.is_demo = false AND h.is_probe = false AND r.is_seed = false AND r.created_at::date >= w.since),
    (SELECT count(*) FROM recipes r JOIN households h ON h.id = r.household_id, window_ w
       WHERE h.is_demo = false AND h.is_probe = false AND r.is_seed = false AND r.created_at::date >= w.since
         AND r.enrichment_status = 'enriched' AND r.image_status <> 'failed'),
    (SELECT count(*) FROM recipes r JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND h.is_probe = false AND r.is_seed = false AND (r.enrichment_status = 'failed' OR r.image_status = 'failed')),
    (SELECT count(*) FROM recipes r JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND h.is_probe = false AND r.is_seed = false AND r.enrichment_status IN ('pending', 'processing') AND r.created_at < now() - interval '1 hour'),
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

-- Privilèges (règle 039) : un CREATE OR REPLACE conserve ceux des fonctions ; la
-- vue est recréée → reposer les siens.
REVOKE ALL ON v3_recipe_people FROM PUBLIC, anon, authenticated;
GRANT SELECT ON v3_recipe_people TO service_role;
