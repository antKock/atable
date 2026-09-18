-- Chantier « Instagram sans Apify » (2026-09-18) — voie de lecture de la
-- légende des imports Instagram (`api.called` sur /api/recipes/import/url,
-- props `ig_path` / `ig_fallback` / `ig_read_ms`), 7 derniers jours.
--   ig_path : direct_embed | direct_og (lecture directe par le VPS) | apify
--             (secours) | cache (déjà lue < 24 h) | failed (aucune voie)
--   ig_fallback : raisons d'abandon de la lecture directe, page embed puis page
--             du reel (`http_429/login_wall`, `no_caption/no_caption`…)
--   read_ms : lecture de la légende seule ; total_ms : tout l'appel (+ modèle)
-- Taux de secours = (apify + failed) / lectures hors cache ; seuil d'alerte
-- dans la Santé (> 30 % sur 24 h dès 5 lectures).
WITH ig AS (
  SELECT props->>'ig_path' AS ig_path,
         props->>'ig_fallback' AS ig_fallback,
         (props->>'ig_read_ms')::int AS read_ms,
         (props->>'duration_ms')::int AS total_ms,
         (props->>'status')::int AS status,
         is_demo, platform
  FROM events
  WHERE name = 'api.called'
    AND props->>'route' = '/api/recipes/import/url'
    AND props ? 'ig_path'
    AND at >= now() - interval '7 days'
)
SELECT ig_path,
       count(*) AS imports,
       count(*) FILTER (WHERE status = 200) AS reussis,
       count(*) FILTER (WHERE is_demo) AS demo,
       CASE WHEN ig_path <> 'cache' THEN
         round(100.0 * count(*) / nullif(sum(count(*) FILTER (WHERE ig_path <> 'cache')) OVER (), 0), 1)
       END AS pct_des_lectures,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY read_ms))::numeric) AS median_read_ms,
       round((percentile_cont(0.9) WITHIN GROUP (ORDER BY read_ms))::numeric) AS p90_read_ms,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY total_ms))::numeric) AS median_total_ms,
       mode() WITHIN GROUP (ORDER BY ig_fallback) AS raison_principale
FROM ig
GROUP BY ig_path
ORDER BY imports DESC;
