-- Migration 041 : les « essais démo » ne comptent plus les clients non-navigateur.
--
-- Constat (revue du 2026-09-07) : le pic d'essais démo du week-end venait à
-- 18/28 de sondes automatisées (curl de Claude Code lors des vérifications de
-- la migration VPS). Ces sessions ont une plateforme `unknown` (user-agent
-- absent ou non parsable → « Appareil inconnu · Navigateur inconnu ») et ne
-- produisent jamais de ping d'activité ; un navigateur ou l'app Capacitor
-- donnent toujours `web` / `ios` / `android`.
--
-- Changement : `demo_stats_rollup` (compte quotidien) et `analytics_demo_funnel`
-- (recompte live, en GREATEST avec stats_daily) excluent `platform = 'unknown'`
-- des essais. `analytics_demo_summary` dérive du funnel : rien à changer.
-- Les sessions de sonde déjà présentes en prod ont été supprimées à la main le
-- 2026-09-07 et `stats_daily.demo_trials` corrigé pour les 4, 5 et 6 septembre
-- (le rollup ne baisse jamais une valeur : GREATEST).
--
-- Corps recopiés de la 039 (bornage p_days) ; `SET search_path` et privilèges
-- reposés (un CREATE OR REPLACE vide proconfig). À appliquer staging puis prod,
-- sans dépendance de déploiement (signatures inchangées).

CREATE OR REPLACE FUNCTION demo_stats_rollup(p_demo_households uuid[], p_days int DEFAULT 30)
RETURNS void
LANGUAGE sql VOLATILE
SET search_path = public
AS $$
  INSERT INTO stats_daily AS s (
    day, demo_trials, demo_active_devices, demo_recipes_added, demo_ai_calls,
    recovery_tokens_sent, recovery_tokens_used,
    merge_tokens_sent, merge_tokens_used, tokens_burned
  )
  SELECT
    g.d,
    -- Essais : sessions démo créées ce jour depuis un navigateur ou l'app
    -- (les clients non-navigateur — sondes, scripts — sont `unknown`).
    (SELECT count(*) FROM device_sessions ds
       WHERE ds.household_id = ANY(p_demo_households) AND ds.created_at::date = g.d
         AND ds.platform <> 'unknown'),
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

CREATE OR REPLACE FUNCTION analytics_demo_funnel(p_days int DEFAULT 90)
RETURNS TABLE (day date, trials bigint, conversions bigint)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT g.d AS day,
    GREATEST(
      COALESCE((SELECT s.demo_trials FROM stats_daily s WHERE s.day = g.d), 0),
      (SELECT count(*) FROM device_sessions ds
         JOIN households h ON h.id = ds.household_id
         WHERE h.is_demo AND ds.created_at::date = g.d
           AND ds.platform <> 'unknown')
    )::bigint AS trials,
    (SELECT count(*) FROM owners o
       WHERE o.demo_trial_started_at IS NOT NULL AND o.created_at::date = g.d
         AND owner_is_real(o.id)) AS conversions
  FROM (
    SELECT (current_date - g)::date AS d
    FROM generate_series(0, LEAST(GREATEST(p_days, 1), 1100) - 1) g
  ) g
  ORDER BY g.d;
$$;

-- Privilèges : réservés à service_role (règle 039).
REVOKE ALL ON FUNCTION demo_stats_rollup(uuid[], int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_demo_funnel(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION demo_stats_rollup(uuid[], int) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_demo_funnel(int) TO service_role;
