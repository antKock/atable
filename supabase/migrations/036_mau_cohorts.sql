-- Migration 036: MAU par génération (mois d'arrivée) — suivi de cohorte.
--
-- Remplace la lecture par bandes d'ancienneté (035) : les personnes migraient
-- de bande en bande, ce qui faisait « churner » les couches et rendait le
-- graphe illisible. Ici chaque strate = une GÉNÉRATION figée (les personnes
-- arrivées le même mois, date_trunc sur owners.created_at) : une strate qui
-- persiste dans le temps = génération retenue, une strate qui s'évapore =
-- churn de cette génération. Regroupement par trimestre prévu quand les
-- strates mensuelles seront trop nombreuses (côté app, la SQL reste au mois).
--
-- Format long (jour × cohorte × mau) : le nombre de cohortes est dynamique,
-- le pivot se fait côté client (même pattern que analytics_retention_cohorts).
-- La somme des cohortes d'un jour = le MAU d'analytics_active_daily (033).
--
-- Purement ADDITIVE : sûre à appliquer avant le déploiement du code. La
-- suppression d'analytics_active_daily_tenure (035, remplacée) part dans la
-- 037, à appliquer APRÈS le déploiement — le code en prod l'appelle encore.

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
      AND d.day >= current_date - (p_days + 29)
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
    FROM generate_series(0, p_days - 1) g
  ) g
  JOIN owner_days o ON o.day BETWEEN g.d - 29 AND g.d
  JOIN owner_birth b ON b.owner_id = o.owner_id
  GROUP BY g.d, b.cohort
  ORDER BY g.d, b.cohort;
$$;
