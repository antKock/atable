-- Q3 — Import, 28 derniers jours : par méthode, combien de tentatives, quelle
-- issue, quelle cause d'échec, quelle attente. Personnes réelles + démo (colonne).
SELECT f.first_method AS method,
       f.is_demo,
       count(*) AS sessions,
       count(*) FILTER (WHERE outcome = 'saved') AS saved,
       count(*) FILTER (WHERE outcome = 'extracted_not_saved') AS extracted_not_saved,
       count(*) FILTER (WHERE outcome = 'extract_failed') AS extract_failed,
       count(*) FILTER (WHERE outcome = 'started_only') AS started_only,
       mode() WITHIN GROUP (ORDER BY first_error_code) AS top_error_code,
       (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY e.duration_ms))::numeric) FROM v_import_extracted e
         WHERE e.method = f.first_method AND e.at >= now() - interval '28 days') AS median_extract_ms
FROM v_import_funnel f
WHERE f.started_at >= now() - interval '28 days'
GROUP BY f.first_method, f.is_demo
ORDER BY f.is_demo, sessions DESC;
