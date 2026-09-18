-- Chantier « OCR sur l'appareil » (2026-09-18) — répartition réelle des imports
-- photo par nature d'image, estimée par gpt-4o dans l'appel OCR lui-même
-- (`api.called` sur /api/recipes/import/screenshot, prop `image_kind`, succès
-- seulement). Sert à pondérer le banc Apple Vision : captures / pages imprimées /
-- manuscrits. Depuis le 2026-09-18 (avant : pas de prop, lignes « (absent) »).
-- Personnes réelles et démo séparées (colonne), par plateforme.
SELECT coalesce(props->>'image_kind', '(absent)') AS image_kind,
       is_demo,
       platform,
       count(*) AS imports,
       count(DISTINCT coalesce(owner_id::text, anon_id::text)) AS personnes,
       round(100.0 * count(*) / sum(count(*)) OVER (PARTITION BY is_demo), 1) AS pct_du_total,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'duration_ms')::int))::numeric) AS median_ms
FROM events
WHERE name = 'api.called'
  AND props->>'route' = '/api/recipes/import/screenshot'
  AND (props->>'status')::int = 200
  AND at >= now() - interval '28 days'
GROUP BY 1, 2, 3
ORDER BY is_demo, imports DESC;
