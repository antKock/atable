-- Migration 039: privilèges et search_path des fonctions serveur (revue 2026-09).
--
-- À appliquer staging puis prod via `supabase db push --linked` ; sans
-- dépendance de déploiement (aucune signature ni aucun résultat ne change).
--
-- Trois trous relevés par la revue / l'advisor Supabase :
--
--   1. EXECUTE public par défaut. PostgreSQL accorde EXECUTE à PUBLIC sur toute
--      fonction créée, et Supabase y ajoute (default privileges du rôle
--      postgres) anon, authenticated et service_role. Nos fonctions
--      analytics_* / demo_stats_rollup / stats_daily_increment / merge_owners /
--      verify_login_code ne sont appelées QUE côté serveur avec la clé service
--      role (src/lib/supabase/server.ts est le seul client Supabase du repo —
--      pas de client navigateur, vérifié par grep). Exposées à anon via
--      PostgREST (/rest/v1/rpc/…), elles laissaient lire des agrégats produit,
--      incrémenter stats_daily ou fusionner des owners avec la seule clé anon.
--      → REVOKE FROM PUBLIC, anon, authenticated ; GRANT EXECUTE TO service_role
--        (explicite, car la révocation de PUBLIC lui retirerait l'héritage).
--
--   2. Default privileges. `ALTER DEFAULT PRIVILEGES` est indexé par le rôle
--      CRÉATEUR : sur Supabase, `supabase db push` s'exécute en `postgres`,
--      donc c'est l'entrée `FOR ROLE postgres IN SCHEMA public` qu'il faut
--      modifier (celle que Supabase pose à la création du projet avec
--      « GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role »).
--      Les fonctions futures naîtront sans EXECUTE pour anon/authenticated/PUBLIC ;
--      service_role reste dans l'entrée. Une fonction qui devrait un jour être
--      appelée avec la clé anon devra recevoir un GRANT explicite.
--
--   3. Advisor `function_search_path_mutable` : sans search_path figé, un rôle
--      capable de créer des objets dans un schéma prioritaire pourrait détourner
--      un nom non qualifié. Les corps ne référencent que des tables de `public`
--      et des fonctions built-in (pg_catalog, toujours résolu en premier) : aucune
--      extension. → `SET search_path = public` sur chacune. Contrepartie assumée :
--      une fonction SQL porteuse d'un SET n'est plus inlinable par le planificateur
--      (owner_is_real / owner_in_carnets, appelées par ligne) — volumes du
--      dashboard négligeables, mesuré comme acceptable.
--
-- Et un garde-fou de défense en profondeur : `p_days` borné en SQL à [1, 1100]
-- (~3 ans, bien au-delà de « depuis le début ») sur les fonctions dont le coût
-- est proportionnel au paramètre (grille generate_series × sous-requêtes par
-- jour). Les autres fonctions à p_days (login_frequency, depth, recovery,
-- ai_cost_daily, ai_cost_summary, ai_cost_demo_daily, sharing) ne font qu'un
-- filtre `>= current_date - p_days` borné par la taille des tables : laissées
-- telles quelles. p_max_week (retention) et p_months (source_mix_monthly) sont
-- des constantes de l'app (8 / 9), non bornées ici.
--
-- Idempotente : CREATE OR REPLACE, boucle sur pg_proc (une fonction absente sur
-- un env — ex. 037 non appliquée — n'est simplement pas visitée). Les CREATE OR
-- REPLACE précèdent le bloc ALTER : un CREATE OR REPLACE remet à zéro les
-- options (proconfig) d'une fonction, le SET search_path doit venir après.

-- ============================================================
-- 1. p_days borné — corps identiques à 033 / 036 / 038, seule l'expression
--    LEAST(GREATEST(p_days, 1), 1100) remplace p_days.
-- ============================================================

CREATE OR REPLACE FUNCTION analytics_active_daily(
  p_days          int    DEFAULT 90,
  p_platform      text   DEFAULT NULL,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (day date, wau bigint, mau bigint, mau_devices bigint, stickiness numeric)
LANGUAGE sql STABLE AS $$
  WITH owner_days AS (
    SELECT DISTINCT d.owner_id, d.day
    FROM daily_activity d
    WHERE d.owner_id IS NOT NULL
      AND d.day >= current_date - (LEAST(GREATEST(p_days, 1), 1100) + 29)
      AND (p_platform IS NULL OR d.platform = p_platform)
      AND owner_is_real(d.owner_id)
      AND owner_in_carnets(d.owner_id, p_household_ids)
  ),
  -- Ancienne métrique (appareils, périmètre v1) : l'écart avec mau mesure le
  -- bruit des identités fantômes. Affichée en filigrane sur le chart.
  device_days AS (
    SELECT DISTINCT d.device_id, d.day
    FROM daily_activity d
    JOIN households h ON h.id = d.household_id
    WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND d.device_id IS NOT NULL
      AND d.day >= current_date - (LEAST(GREATEST(p_days, 1), 1100) + 29)
      AND (p_platform IS NULL OR d.platform = p_platform)
      AND (p_household_ids IS NULL OR d.household_id = ANY(p_household_ids))
  )
  SELECT t.day, t.wau, t.mau, t.mau_devices,
         round(100.0 * t.wau / nullif(t.mau, 0), 1) AS stickiness
  FROM (
    SELECT g.d AS day,
      (SELECT count(DISTINCT o.owner_id) FROM owner_days o
         WHERE o.day BETWEEN g.d - 6 AND g.d) AS wau,
      (SELECT count(DISTINCT o.owner_id) FROM owner_days o
         WHERE o.day BETWEEN g.d - 29 AND g.d) AS mau,
      (SELECT count(DISTINCT dd.device_id) FROM device_days dd
         WHERE dd.day BETWEEN g.d - 29 AND g.d) AS mau_devices
    FROM (
      SELECT (current_date - g)::date AS d
      FROM generate_series(0, LEAST(GREATEST(p_days, 1), 1100) - 1) g
    ) g
  ) t
  ORDER BY t.day;
$$;

CREATE OR REPLACE FUNCTION analytics_active_daily_cohorts(
  p_days          int    DEFAULT 90,
  p_platform      text   DEFAULT NULL,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (day date, cohort date, mau bigint)
LANGUAGE sql STABLE AS $$
  WITH owner_days AS (
    SELECT DISTINCT d.owner_id, d.day
    FROM daily_activity d
    WHERE d.owner_id IS NOT NULL
      AND d.day >= current_date - (LEAST(GREATEST(p_days, 1), 1100) + 29)
      AND (p_platform IS NULL OR d.platform = p_platform)
      AND owner_is_real(d.owner_id)
      AND owner_in_carnets(d.owner_id, p_household_ids)
  ),
  owner_birth AS (
    SELECT DISTINCT od.owner_id, date_trunc('month', ow.created_at)::date AS cohort
    FROM owner_days od
    JOIN owners ow ON ow.id = od.owner_id
  )
  SELECT g.d AS day, b.cohort, count(DISTINCT o.owner_id) AS mau
  FROM (
    SELECT (current_date - g)::date AS d
    FROM generate_series(0, LEAST(GREATEST(p_days, 1), 1100) - 1) g
  ) g
  JOIN owner_days o ON o.day BETWEEN g.d - 29 AND g.d
  JOIN owner_birth b ON b.owner_id = o.owner_id
  GROUP BY g.d, b.cohort
  ORDER BY g.d, b.cohort;
$$;

CREATE OR REPLACE FUNCTION analytics_cumulative_parc_daily(p_days int DEFAULT 90)
RETURNS TABLE (day date, owners bigint, carnets bigint)
LANGUAGE sql STABLE AS $$
  SELECT g.d AS day,
    (SELECT count(*) FROM owners o
       WHERE owner_is_real(o.id) AND o.created_at::date <= g.d),
    (SELECT count(*) FROM households h
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND h.created_at::date <= g.d)
  FROM (
    SELECT (current_date - g)::date AS d
    FROM generate_series(0, LEAST(GREATEST(p_days, 1), 1100) - 1) g
  ) g
  ORDER BY g.d;
$$;

CREATE OR REPLACE FUNCTION analytics_acquisition_daily(p_days int DEFAULT 90)
RETURNS TABLE (day date, new_owners bigint, new_carnets bigint, first_carnets bigint)
LANGUAGE sql STABLE AS $$
  SELECT g.d AS day,
    (SELECT count(*) FROM owners o
       WHERE owner_is_real(o.id) AND o.created_at::date = g.d),
    (SELECT count(*) FROM households h
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND h.created_at::date = g.d),
    (SELECT count(*) FROM households h
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND h.created_at::date = g.d
         AND h.origin IN ('landing', 'demo_conversion'))
  FROM (
    SELECT (current_date - g)::date AS d
    FROM generate_series(0, LEAST(GREATEST(p_days, 1), 1100) - 1) g
  ) g
  ORDER BY g.d;
$$;

CREATE OR REPLACE FUNCTION analytics_demo_funnel(p_days int DEFAULT 90)
RETURNS TABLE (day date, trials bigint, conversions bigint)
LANGUAGE sql STABLE AS $$
  SELECT g.d AS day,
    GREATEST(
      COALESCE((SELECT s.demo_trials FROM stats_daily s WHERE s.day = g.d), 0),
      (SELECT count(*) FROM device_sessions ds
         JOIN households h ON h.id = ds.household_id
         WHERE h.is_demo AND ds.created_at::date = g.d)
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

CREATE OR REPLACE FUNCTION analytics_demo_summary(p_days int DEFAULT 30)
RETURNS TABLE (
  trials                  bigint,
  conversions             bigint,
  conversion_pct          numeric,
  activated_7d            bigint,
  median_hours_to_convert numeric,
  demo_recipes            bigint,
  demo_ai_calls           bigint,
  frozen_hits             bigint
)
LANGUAGE sql STABLE AS $$
  WITH f AS (
    SELECT * FROM analytics_demo_funnel(LEAST(GREATEST(p_days, 1), 1100))
  ),
  converted AS (
    -- Même fenêtre que la grille du funnel : p_days jours, aujourd'hui inclus
    -- (sinon « activés » pourrait dépasser « conversions » d'un jour de bord).
    SELECT o.id, o.created_at, o.demo_trial_started_at
    FROM owners o
    WHERE o.demo_trial_started_at IS NOT NULL
      AND o.created_at::date >= current_date - (LEAST(GREATEST(p_days, 1), 1100) - 1)
      AND owner_is_real(o.id)
  ),
  demo_activity AS (
    SELECT g.d,
      GREATEST(
        COALESCE((SELECT s.demo_recipes_added FROM stats_daily s WHERE s.day = g.d), 0),
        (SELECT count(*) FROM recipes r JOIN households h ON h.id = r.household_id
           WHERE h.is_demo AND r.is_seed = false AND r.created_at::date = g.d)
      ) AS recipes_added,
      GREATEST(
        COALESCE((SELECT s.demo_ai_calls FROM stats_daily s WHERE s.day = g.d), 0),
        (SELECT count(*) FROM ai_costs c JOIN households h ON h.id = c.household_id
           WHERE h.is_demo AND c.created_at::date = g.d)
      ) AS ai_calls,
      COALESCE((SELECT s.demo_frozen_hits FROM stats_daily s WHERE s.day = g.d), 0) AS frozen
    FROM (SELECT (current_date - i)::date AS d FROM generate_series(0, LEAST(GREATEST(p_days, 1), 1100) - 1) i) g
  )
  SELECT
    (SELECT COALESCE(sum(trials), 0) FROM f),
    (SELECT COALESCE(sum(conversions), 0) FROM f),
    round(100.0 * (SELECT COALESCE(sum(conversions), 0) FROM f)
          / nullif((SELECT sum(trials) FROM f), 0), 1),
    (SELECT count(*) FROM converted c
       WHERE EXISTS (
         SELECT 1 FROM recipes r
         JOIN device_sessions ds ON ds.id = r.created_by_device_id
         WHERE ds.owner_id = c.id AND r.is_seed = false
           AND r.created_at <= c.created_at + interval '7 days')),
    (SELECT round((percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (c.created_at - c.demo_trial_started_at)) / 3600.0
      ))::numeric, 1) FROM converted c),
    (SELECT COALESCE(sum(recipes_added), 0) FROM demo_activity),
    (SELECT COALESCE(sum(ai_calls), 0) FROM demo_activity),
    (SELECT COALESCE(sum(frozen), 0) FROM demo_activity);
$$;

-- Variante tableau (038) ; l'alias uuid (038) lui délègue et hérite de la borne.
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

-- ============================================================
-- 2. Default privileges des fonctions à venir (rôle créateur = postgres)
-- ============================================================

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 3. Fonctions existantes : EXECUTE réservé à service_role, search_path figé
-- ============================================================
-- Boucle sur pg_proc plutôt qu'une liste de signatures : robuste aux env où
-- une fonction manque, et aux surcharges (demo_stats_rollup uuid / uuid[]).
-- Périmètre = toutes les fonctions serveur de `public` créées par nos
-- migrations (analytics_*, prédicats partagés de la 033, compteurs 032/038,
-- fusion/récupération 028/029). Aucune fonction ne doit rester exposée : rien
-- dans src/ n'appelle de RPC autrement qu'avec la clé service role.

DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (
        p.proname LIKE 'analytics\_%'
        OR p.proname IN (
          'owner_is_real', 'owner_in_carnets', 'carnet_activity',
          'stats_daily_increment', 'demo_stats_rollup',
          'merge_owners', 'verify_login_code'
        )
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', f.sig);
  END LOOP;
END;
$$;
