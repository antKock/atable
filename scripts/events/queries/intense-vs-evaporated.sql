-- Q2 — « Essaie puis s'évapore » : que font, la PREMIÈRE semaine, les personnes
-- qui sont encore là à J+28 (intenses) et celles qui ont disparu (évaporées) ?
-- Une ligne par groupe, mêmes indicateurs — les écarts sont les pistes.
WITH people AS (
  SELECT o.id AS owner_id, o.created_at
  FROM owners o
  WHERE owner_is_real(o.id) AND o.created_at < now() - interval '28 days'
),
week1 AS (
  SELECT p.owner_id, p.created_at,
         count(DISTINCT s.session_no) AS sessions_w1,
         count(DISTINCT rv.recipe_id) AS recipes_viewed_w1,
         (SELECT count(*) FROM v_recipe_saved r WHERE r.owner_id = p.owner_id AND r.at < p.created_at + interval '7 days') AS recipes_saved_w1,
         (SELECT count(*) FROM v_cooking c WHERE c.owner_id = p.owner_id AND c.at < p.created_at + interval '7 days') AS cookings_w1,
         (SELECT count(*) FROM v_import_extracted e WHERE e.owner_id = p.owner_id AND NOT e.ok AND e.at < p.created_at + interval '7 days') AS import_failures_w1,
         EXISTS (SELECT 1 FROM v_sessions s2 WHERE s2.owner_id = p.owner_id AND s2.started_at >= p.created_at + interval '21 days') AS still_there_d28
  FROM people p
  LEFT JOIN v_sessions s ON s.owner_id = p.owner_id AND s.started_at < p.created_at + interval '7 days'
  LEFT JOIN v_recipe_views rv ON rv.owner_id = p.owner_id AND rv.at < p.created_at + interval '7 days'
  GROUP BY p.owner_id, p.created_at
)
SELECT CASE WHEN still_there_d28 THEN 'intenses (là à J+28)' ELSE 'évaporées' END AS groupe,
       count(*) AS people,
       round(avg(sessions_w1), 1) AS sessions_w1,
       round(avg(recipes_viewed_w1), 1) AS recipes_viewed_w1,
       round(avg(recipes_saved_w1), 1) AS recipes_saved_w1,
       round(avg(cookings_w1), 1) AS cookings_w1,
       round(avg(import_failures_w1), 2) AS import_failures_w1
FROM week1
GROUP BY still_there_d28
ORDER BY still_there_d28 DESC;
