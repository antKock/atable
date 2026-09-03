-- Migration 035: MAU décomposé par ancienneté des personnes (« layer cake »).
--
-- La courbe MAU seule ne distingue pas deux réalités opposées : une croissance
-- par CUMUL des générations (les anciens restent, les nouveaux s'empilent) ou
-- un SEAU PERCÉ (que du sang neuf qui ne revient jamais). On décompose donc le
-- MAU personnes en bandes d'ancienneté mensuelles, mesurée au jour observé :
--   < 1 mois · 1–2 mois · 2–3 mois · 3 mois + (depuis owners.created_at).
-- Chaque personne active tombe dans exactement une bande → la somme des quatre
-- séries = le MAU d'analytics_active_daily (033), mêmes filtres, même fenêtre
-- glissante 30 j. Même époque de mesure que le MAU (repère ➀ du 10 juil.).
--
-- Purement ADDITIVE : sûre à appliquer avant le déploiement du code. Le DROP
-- ne vise que la variante 3 bandes de cette même migration (jamais déployée
-- en code) — ré-application manuelle idempotente si la version 035 est déjà
-- enregistrée dans schema_migrations.

DROP FUNCTION IF EXISTS analytics_active_daily_tenure(int, text, uuid[]);
CREATE FUNCTION analytics_active_daily_tenure(
  p_days          int    DEFAULT 90,
  p_platform      text   DEFAULT NULL,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (day date, mau_old bigint, mau_m3 bigint, mau_m2 bigint, mau_m1 bigint)
LANGUAGE sql STABLE AS $$
  WITH owner_days AS (
    SELECT DISTINCT d.owner_id, d.day
    FROM daily_activity d
    WHERE d.owner_id IS NOT NULL
      AND d.day >= current_date - (p_days + 29)
      AND (p_platform IS NULL OR d.platform = p_platform)
      AND owner_is_real(d.owner_id)
      AND owner_in_carnets(d.owner_id, p_household_ids)
  ),
  owner_birth AS (
    SELECT DISTINCT od.owner_id, ow.created_at::date AS born
    FROM owner_days od
    JOIN owners ow ON ow.id = od.owner_id
  )
  SELECT g.d AS day,
    (SELECT count(DISTINCT o.owner_id) FROM owner_days o
       JOIN owner_birth b ON b.owner_id = o.owner_id
       WHERE o.day BETWEEN g.d - 29 AND g.d AND g.d - b.born >= 90) AS mau_old,
    (SELECT count(DISTINCT o.owner_id) FROM owner_days o
       JOIN owner_birth b ON b.owner_id = o.owner_id
       WHERE o.day BETWEEN g.d - 29 AND g.d AND g.d - b.born BETWEEN 60 AND 89) AS mau_m3,
    (SELECT count(DISTINCT o.owner_id) FROM owner_days o
       JOIN owner_birth b ON b.owner_id = o.owner_id
       WHERE o.day BETWEEN g.d - 29 AND g.d AND g.d - b.born BETWEEN 30 AND 59) AS mau_m2,
    (SELECT count(DISTINCT o.owner_id) FROM owner_days o
       JOIN owner_birth b ON b.owner_id = o.owner_id
       WHERE o.day BETWEEN g.d - 29 AND g.d AND g.d - b.born < 30) AS mau_m1
  FROM (
    SELECT (current_date - g)::date AS d
    FROM generate_series(0, p_days - 1) g
  ) g
  ORDER BY g.d;
$$;
