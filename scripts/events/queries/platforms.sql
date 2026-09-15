-- Q7 — iOS / Android / web, 28 derniers jours : sessions, écrans par session,
-- durée médiane, part avec une erreur d'API, personnes distinctes.
SELECT platform,
       count(*) AS sessions,
       count(DISTINCT owner_id) AS people,
       round(avg(n_screens), 1) AS screens_per_session,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM ended_at - started_at)) / 60)::numeric, 1) AS median_minutes,
       round(100.0 * count(*) FILTER (WHERE n_api_errors > 0) / count(*), 1) AS pct_with_api_error
FROM v_sessions
WHERE started_at >= now() - interval '28 days' AND NOT is_demo
GROUP BY platform
ORDER BY sessions DESC;
