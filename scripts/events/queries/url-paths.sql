-- Import par URL hors Instagram (2026-09-19) — voie de lecture de la page
-- (`api.called` sur /api/recipes/import/url, props `url_path` / `url_fallback` /
-- `url_read_ms`), 28 derniers jours, par site.
--   url_path : direct (fetch du VPS) | crawler (Apify, navigateur headless) | failed
--   url_fallback : pourquoi le VPS a abandonné — http_403 / http_429 (site qui
--     bloque le VPS : la lecture par le téléphone le résoudrait), thin_content
--     (page vide sans JavaScript : le téléphone n'y peut rien), timeout, network…
-- Question servie : quelle part du crawler la lecture sur le téléphone éviterait.
SELECT props->>'site' AS site,
       props->>'url_path' AS url_path,
       props->>'url_fallback' AS raison,
       count(*) AS imports,
       count(*) FILTER (WHERE (props->>'status')::int = 200) AS reussis,
       count(DISTINCT coalesce(owner_id::text, anon_id::text)) AS personnes,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'url_read_ms')::int))::numeric) AS median_read_ms
FROM events
WHERE name = 'api.called'
  AND props->>'route' = '/api/recipes/import/url'
  AND props ? 'url_path'
  AND at >= now() - interval '28 days'
GROUP BY 1, 2, 3
ORDER BY url_path <> 'direct' DESC, imports DESC;
