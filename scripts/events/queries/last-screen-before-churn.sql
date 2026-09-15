-- Q2 — Dernier écran vu par les personnes qui ont disparu : dernière session
-- il y a plus de 14 jours, personne réelle (ni démo, ni sonde, ni test).
-- Lecture : sur quel écran s'arrête-t-on juste avant de ne plus revenir ?
WITH last_sessions AS (
  SELECT DISTINCT ON (s.owner_id) s.owner_id, s.started_at, s.last_route, s.n_screens, s.platform
  FROM v_sessions s
  WHERE s.owner_id IS NOT NULL AND NOT s.is_demo AND owner_is_real(s.owner_id)
  ORDER BY s.owner_id, s.started_at DESC
)
SELECT last_route,
       count(*) AS people,
       round(avg(n_screens), 1) AS avg_screens_last_session,
       string_agg(DISTINCT platform, ', ') AS platforms
FROM last_sessions
WHERE started_at < now() - interval '14 days'
GROUP BY last_route
ORDER BY people DESC;
