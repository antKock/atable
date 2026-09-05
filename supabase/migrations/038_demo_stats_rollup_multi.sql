-- 038 — demo_stats_rollup sur PLUSIEURS foyers démo (chantier Version EN, Lot 3).
--
-- Depuis la 032, le cron demo-reset appelait demo_stats_rollup(p_demo_household)
-- pour un seul foyer. Avec le foyer démo EN, l'appeler foyer par foyer donnait
-- le MAX FR/EN par jour (upsert GREATEST), pas la somme. Cette variante agrège
-- l'ensemble des foyers passés en un seul passage ; l'ancienne signature est
-- conservée comme alias (déploiements en cours, scripts).
-- Additive, idempotente, sans effet sur les données existantes.

CREATE OR REPLACE FUNCTION demo_stats_rollup(p_demo_households uuid[], p_days int DEFAULT 30)
RETURNS void
LANGUAGE sql VOLATILE AS $$
  INSERT INTO stats_daily AS s (
    day, demo_trials, demo_active_devices, demo_recipes_added, demo_ai_calls,
    recovery_tokens_sent, recovery_tokens_used,
    merge_tokens_sent, merge_tokens_used, tokens_burned
  )
  SELECT
    g.d,
    (SELECT count(*) FROM device_sessions ds
       WHERE ds.household_id = ANY(p_demo_households) AND ds.created_at::date = g.d),
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
  FROM (SELECT (current_date - i)::date AS d FROM generate_series(0, p_days - 1) i) g
  ON CONFLICT (day) DO UPDATE SET
    demo_trials          = GREATEST(s.demo_trials,          EXCLUDED.demo_trials),
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

-- Alias de compatibilité : l'ancienne signature délègue à la variante tableau.
CREATE OR REPLACE FUNCTION demo_stats_rollup(p_demo_household uuid, p_days int DEFAULT 30)
RETURNS void
LANGUAGE sql VOLATILE AS $$
  SELECT demo_stats_rollup(ARRAY[p_demo_household], p_days);
$$;
