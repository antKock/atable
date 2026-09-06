-- Migration 040: jours d'activité par personne — une seule définition (revue 2026-09).
--
-- À appliquer staging puis prod via `supabase db push --linked` ; sans
-- dépendance de déploiement : aucune signature, aucun résultat ne change,
-- aucun DROP (rien ne devient orphelin, il n'y a donc pas de « migration
-- suivante après déploiement » à prévoir).
--
-- Contexte. Quatre fonctions analytics recopiaient le même bloc « paires
-- (owner, jour) d'activité réelle » : daily_activity filtrée par plateforme,
-- restreinte aux personnes réelles (owner_is_real, 033) et au périmètre de
-- carnets demandé (owner_in_carnets, 033), dédoublonnée owner × jour :
--   - analytics_active_daily          (033 → 039)  CTE owner_days, fenêtre p_days + 29
--   - analytics_active_daily_cohorts  (036 → 039)  CTE owner_days, fenêtre p_days + 29
--   - analytics_login_frequency       (033)        inline, fenêtre p_days
--   - analytics_depth                 (033)        inline, fenêtre p_days, sans plateforme
-- Que les strates du MAU par génération (cohorts) somment exactement au MAU
-- (active_daily) reposait sur la discipline — mêmes filtres recopiés — et non
-- sur la construction. Une cinquième copie (analytics_active_daily_tenure, 035)
-- a déjà été supprimée par la 037.
--
-- Ce qui change. `analytics_owner_days(p_days, p_platform, p_household_ids)`
-- porte désormais cette définition, et les quatre fonctions l'appellent.
-- Sémantique de p_days : profondeur de la fenêtre, lignes avec
-- `day >= current_date - p_days` (aujourd'hui inclus). La fonction NE BORNE PAS
-- p_days, à dessein :
--   - active_daily / cohorts gardent leur borne [1, 1100] (039) côté appelant
--     — la même valeur bornée alimente generate_series ET, augmentée de 29, la
--     fenêtre glissante 30 j passée à analytics_owner_days. Une borne à 1100
--     dans la fonction partagée tronquerait la fenêtre pour p_days > 1071 ;
--   - login_frequency / depth restent non bornées, comme décidé en 039 (simple
--     filtre `>= current_date - p_days`, coût borné par la taille de la table).
-- Différences entre copies, conservées telles quelles (pas d'harmonisation
-- silencieuse) : login_frequency et depth n'ajoutent pas les 29 jours de la
-- fenêtre glissante (elles comptent sur p_days, pas sur une grille de jours) ;
-- depth n'a pas de paramètre plateforme (elle passe NULL).
--
-- Garantie d'équivalence. La fonction partagée est exactement l'ancienne CTE ;
-- côté appelants : count(DISTINCT day) GROUP BY owner_id sur les lignes brutes
-- (login_frequency) ≡ count(*) GROUP BY owner_id sur les paires dédoublonnées ;
-- count(*) d'un GROUP BY owner_id, day (depth) ≡ count(*) des paires
-- dédoublonnées. current_date est évalué dans la même transaction. Vérifié sur
-- staging par md5 + count des résultats avant/après sur cinq jeux de paramètres
-- par fonction (dont les bords 0 et 1200).
--
-- Plan. La fonction porte SET search_path (039) donc n'est pas inlinée : elle
-- est exécutée une fois par appel et matérialisée, comme l'était la CTE
-- référencée plusieurs fois. Les appelants la gardent derrière une CTE pour
-- garantir cette évaluation unique.
--
-- Privilèges : comme la 039 — EXECUTE réservé à service_role, search_path figé
-- (posé dans le CREATE, un CREATE OR REPLACE remettant proconfig à zéro ; les
-- ACL, elles, survivent au CREATE OR REPLACE mais sont ré-affirmées ci-dessous
-- pour l'idempotence).

-- ============================================================
-- 1. Définition partagée
-- ============================================================

CREATE OR REPLACE FUNCTION analytics_owner_days(
  p_days          int,
  p_platform      text   DEFAULT NULL,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (owner_id uuid, day date)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT DISTINCT d.owner_id, d.day
  FROM daily_activity d
  WHERE d.owner_id IS NOT NULL
    AND d.day >= current_date - p_days
    AND (p_platform IS NULL OR d.platform = p_platform)
    AND owner_is_real(d.owner_id)
    AND owner_in_carnets(d.owner_id, p_household_ids);
$$;

-- ============================================================
-- 2. Appelants — corps identiques à 039 / 033, seule la source des paires
--    (owner, jour) change.
-- ============================================================

CREATE OR REPLACE FUNCTION analytics_active_daily(
  p_days          int    DEFAULT 90,
  p_platform      text   DEFAULT NULL,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (day date, wau bigint, mau bigint, mau_devices bigint, stickiness numeric)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH owner_days AS (
    SELECT od.owner_id, od.day
    FROM analytics_owner_days(LEAST(GREATEST(p_days, 1), 1100) + 29, p_platform, p_household_ids) od
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
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH owner_days AS (
    SELECT od.owner_id, od.day
    FROM analytics_owner_days(LEAST(GREATEST(p_days, 1), 1100) + 29, p_platform, p_household_ids) od
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

-- Fréquence d'usage : jours actifs distincts par PERSONNE sur p_days.
CREATE OR REPLACE FUNCTION analytics_login_frequency(
  p_days          int    DEFAULT 30,
  p_platform      text   DEFAULT NULL,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (bin text, owners bigint)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH per_owner AS (
    -- Les paires sont déjà dédoublonnées : count(*) = jours actifs distincts.
    SELECT od.owner_id, count(*) AS active_days
    FROM analytics_owner_days(p_days, p_platform, p_household_ids) od
    GROUP BY od.owner_id
  ),
  binned AS (
    SELECT
      CASE
        WHEN active_days = 1               THEN '1 j'
        WHEN active_days BETWEEN 2 AND 3   THEN '2–3 j'
        WHEN active_days BETWEEN 4 AND 7   THEN '4–7 j'
        WHEN active_days BETWEEN 8 AND 15  THEN '8–15 j'
        ELSE '16+ j'
      END AS bin,
      CASE
        WHEN active_days = 1               THEN 0
        WHEN active_days BETWEEN 2 AND 3   THEN 1
        WHEN active_days BETWEEN 4 AND 7   THEN 2
        WHEN active_days BETWEEN 8 AND 15  THEN 3
        ELSE 4
      END AS ord
    FROM per_owner
  )
  SELECT bin, count(*) AS owners
  FROM binned
  GROUP BY bin, ord
  ORDER BY ord;
$$;

-- Profondeur : recettes créées par jour-personne actif (scalaire).
-- Toutes plateformes confondues (pas de paramètre plateforme, inchangé).
CREATE OR REPLACE FUNCTION analytics_depth(
  p_days          int    DEFAULT 30,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT round(
    (SELECT count(*)::numeric FROM recipes r
       JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND r.is_seed = false
         AND r.created_at >= current_date - p_days
         AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids)))
    / nullif((SELECT count(*) FROM analytics_owner_days(p_days, NULL, p_household_ids)), 0)
  , 1);
$$;

-- ============================================================
-- 3. Privilèges (mêmes règles que la 039)
-- ============================================================

REVOKE ALL ON FUNCTION analytics_owner_days(int, text, uuid[])           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_active_daily(int, text, uuid[])         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_active_daily_cohorts(int, text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_login_frequency(int, text, uuid[])      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_depth(int, uuid[])                      FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION analytics_owner_days(int, text, uuid[])           TO service_role;
GRANT EXECUTE ON FUNCTION analytics_active_daily(int, text, uuid[])         TO service_role;
GRANT EXECUTE ON FUNCTION analytics_active_daily_cohorts(int, text, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_login_frequency(int, text, uuid[])      TO service_role;
GRANT EXECUTE ON FUNCTION analytics_depth(int, uuid[])                      TO service_role;
