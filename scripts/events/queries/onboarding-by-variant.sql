-- Q1 — Onboarding par bras A/B (#25), depuis le début du journal : où les
-- nouveaux appareils iOS s'arrêtent-ils entre la landing et la 3e recette ?
-- Les sondes ne sont jamais dans events ; la démo est un chemin (`path`).
SELECT variant,
       count(*) AS landings,
       count(*) FILTER (WHERE first_landing_click IS NOT NULL) AS clicked_something,
       count(*) FILTER (WHERE first_landing_click = 'landing.start') AS clicked_start,
       count(*) FILTER (WHERE first_landing_click = 'landing.demo') AS clicked_demo,
       count(*) FILTER (WHERE path = 'direct') AS cookbook_direct,
       count(*) FILTER (WHERE path = 'demo') AS demo_first,
       count(*) FILTER (WHERE first_recipe_at IS NOT NULL) AS first_recipe,
       count(*) FILTER (WHERE third_recipe_at IS NOT NULL) AS third_recipe,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM first_recipe_at - landing_at)) / 60)::numeric) AS median_min_to_first_recipe
FROM v_onboarding_funnel
WHERE platform = 'ios'
GROUP BY variant
ORDER BY variant;
