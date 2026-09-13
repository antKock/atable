-- 049 — Échecs d'enrichissement « traités » (demande Anthony, 2026-09-13).
-- Le voyant Pipeline (Santé, digest, veilleur #27) comptait tout échec pour
-- toujours : une recette sans image acceptée telle quelle alertait chaque matin.
-- `recipes.failure_acknowledged_at` : posé par le bouton « Considérer comme
-- traité » de /admin/sante ; remis à NULL par le code à chaque NOUVEL échec
-- (enrichment.ts) → un échec traité ne revient que s'il se reproduit.

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS failure_acknowledged_at timestamptz;

-- analytics_v3_health (corps de la 048) : recipes_failed = échecs non traités.
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
       WHERE h.is_demo = false AND h.is_probe = false AND r.is_seed = false
         AND (r.enrichment_status = 'failed' OR r.image_status = 'failed')
         AND r.failure_acknowledged_at IS NULL),
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
