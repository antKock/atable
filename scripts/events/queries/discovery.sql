-- Q8 — La découverte sert-elle ? 28 derniers jours : d'où viennent les
-- consultations de recettes (carrousel, bibliothèque, recherche, partage…),
-- et quels filtres / carrousels sont réellement utilisés.
\echo --- d'où viennent les consultations
SELECT COALESCE(from_route, '(entrée directe)') AS from_route, count(*) AS views, count(DISTINCT owner_id) AS people
FROM v_recipe_views
WHERE at >= now() - interval '28 days' AND NOT is_demo
GROUP BY from_route ORDER BY views DESC;

\echo --- clics de découverte (carrousels, filtres, recherche)
SELECT props->>'target' AS target, count(*) AS clicks, count(DISTINCT owner_id) AS people
FROM events
WHERE name = 'ui.clicked' AND at >= now() - interval '28 days' AND NOT is_demo
  AND (props->>'target' LIKE 'home.carousel.%' OR props->>'target' LIKE 'library.%')
GROUP BY 1 ORDER BY clicks DESC;
