-- 054 — analytics_v3_weekly_active : même résultat, sans produit cartésien corrélé.
--
-- Mesure prod du 2026-09-16 (timings de /api/admin/health) : cette fonction seule
-- prenait ≈ 6 s, soit tout le temps de chargement des pages stats / explorer /
-- santé. La version 043 croisait 16 semaines × N personnes et évaluait, pour
-- chaque paire, trois EXISTS corrélés — dont un sur la vue v3_recipe_people
-- (recipes ⋈ device_sessions ⋈ LATERAL memberships) rejouée à chaque paire —
-- puis répétait le premier EXISTS dans le HAVING.
--
-- Ici les jours d'activité et d'engagement sont lus une seule fois sur la fenêtre
-- utile, projetés sur les semaines (16 × quelques milliers de lignes), puis joints
-- par (semaine, personne). Signature, colonnes, ordre et sémantique inchangés :
--   active  = personnes réelles avec ≥ 1 jour d'activité sur les 28 j clos le dimanche ;
--   engaged = personnes réelles ayant ajouté une recette OU vu une recette sur la
--             même fenêtre (indépendamment de « active », comme en 043) ;
--   lignes  = (semaine, mois de cohorte) avec active > 0.

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
  bounds AS (
    SELECT min(week_end) - 27 AS d_from, max(week_end) AS d_to FROM weeks
  ),
  people AS (
    SELECT o.id, date_trunc('month', o.created_at)::date AS cohort_month
    FROM owners o WHERE owner_is_real(o.id)
  ),
  -- Jours d'activité et d'engagement par personne, lus une fois sur la fenêtre.
  active_days AS (
    SELECT DISTINCT a.owner_id, a.day
    FROM daily_activity a, bounds b
    WHERE a.owner_id IS NOT NULL AND a.day BETWEEN b.d_from AND b.d_to
  ),
  engaged_days AS (
    SELECT DISTINCT x.owner_id, x.day
    FROM (
      SELECT rp.owner_id, rp.created_at::date AS day
      FROM v3_recipe_people rp, bounds b
      WHERE rp.owner_id IS NOT NULL AND rp.created_at::date BETWEEN b.d_from AND b.d_to
      UNION ALL
      SELECT v.owner_id, v.day
      FROM recipe_views_daily v, bounds b
      WHERE v.day BETWEEN b.d_from AND b.d_to
    ) x
  ),
  -- Projection sur les semaines : (semaine, personne) active / engagée.
  active_pairs AS (
    SELECT DISTINCT w.week_end, d.owner_id
    FROM active_days d JOIN weeks w ON d.day BETWEEN w.week_end - 27 AND w.week_end
  ),
  engaged_pairs AS (
    SELECT DISTINCT w.week_end, d.owner_id
    FROM engaged_days d JOIN weeks w ON d.day BETWEEN w.week_end - 27 AND w.week_end
  )
  SELECT w.week_end, p.cohort_month,
    count(*) FILTER (WHERE ap.owner_id IS NOT NULL) AS active,
    count(*) FILTER (WHERE ep.owner_id IS NOT NULL) AS engaged
  FROM weeks w CROSS JOIN people p
  LEFT JOIN active_pairs  ap ON ap.week_end = w.week_end AND ap.owner_id = p.id
  LEFT JOIN engaged_pairs ep ON ep.week_end = w.week_end AND ep.owner_id = p.id
  GROUP BY w.week_end, p.cohort_month
  HAVING count(*) FILTER (WHERE ap.owner_id IS NOT NULL) > 0
  ORDER BY w.week_end, p.cohort_month;
$$;

REVOKE ALL ON FUNCTION analytics_v3_weekly_active(int) FROM PUBLIC, anon, authenticated;
