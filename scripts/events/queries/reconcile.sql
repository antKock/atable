-- Réconciliation compteurs ↔ événements, 14 derniers jours clos (J-14 → J-1).
-- Deux sources indépendantes qui doivent dire la même chose : un écart est
-- soit un bug de l'ancienne instrumentation, soit un trou de la nouvelle.
-- À lire chaque semaine pendant la double lecture (spec §8.3, lot 3) ; quand
-- une ligne concorde 4 semaines de suite, son compteur peut disparaître.
--
-- Colonnes : `counter` = l'ancienne source (stats_daily, daily_activity,
-- recipe_views_daily, recipes.source), `events` = le journal, `diff`.
WITH w AS (SELECT (current_date - 14)::date AS d0, (current_date - 1)::date AS d1),
cmp AS (
-- 1. Ouvertures d'app : appareils actifs par jour (ping) vs app.opened
SELECT 'appareils actifs / jour (ping vs app.opened)' AS metric,
       (SELECT count(DISTINCT (device_id, day)) FROM daily_activity a, w WHERE a.day BETWEEN w.d0 AND w.d1 AND a.origin = 'ping')::bigint AS counter,
       (SELECT count(DISTINCT (device_id, at::date)) FROM events e, w WHERE e.name = 'app.opened' AND e.device_id IS NOT NULL AND e.at::date BETWEEN w.d0 AND w.d1)::bigint AS events
UNION ALL
-- 2. Consultations de recettes (recipe_views_daily) vs v_recipe_views
SELECT 'consultations de recettes',
       (SELECT COALESCE(sum(views), 0) FROM recipe_views_daily r, w WHERE r.day BETWEEN w.d0 AND w.d1),
       (SELECT count(*) FROM v_recipe_views v, w WHERE v.owner_id IS NOT NULL AND v.at::date BETWEEN w.d0 AND w.d1)
UNION ALL
-- 3. Essais démo (stats_daily.demo_trials) vs POST /api/demo/session réussis
SELECT 'essais démo',
       (SELECT COALESCE(sum(demo_trials), 0) FROM stats_daily s, w WHERE s.day BETWEEN w.d0 AND w.d1),
       (SELECT count(*) FROM events e, w WHERE e.name = 'api.called' AND e.props->>'route' = '/api/demo/session'
          AND (e.props->>'status')::int < 300 AND e.at::date BETWEEN w.d0 AND w.d1)
UNION ALL
-- 4. A/B : affectations iOS par bras (stats_daily) vs premières vues de la landing en shell iOS
SELECT 'A/B affectations iOS bras A',
       (SELECT COALESCE(sum(ab_onboarding_a_ios), 0) FROM stats_daily s, w WHERE s.day BETWEEN w.d0 AND w.d1),
       (SELECT count(*) FROM v_onboarding_funnel f, w WHERE f.platform = 'ios' AND f.variant = 'a' AND f.landing_at::date BETWEEN w.d0 AND w.d1)
UNION ALL
SELECT 'A/B affectations iOS bras B',
       (SELECT COALESCE(sum(ab_onboarding_b_ios), 0) FROM stats_daily s, w WHERE s.day BETWEEN w.d0 AND w.d1),
       (SELECT count(*) FROM v_onboarding_funnel f, w WHERE f.platform = 'ios' AND f.variant = 'b' AND f.landing_at::date BETWEEN w.d0 AND w.d1)
UNION ALL
-- 5. Recettes créées par méthode : recipes.source vs v_recipe_saved (hors démo, hors seed)
SELECT 'recettes créées · ' || r.source,
       count(*)::bigint,
       (SELECT count(*) FROM v_recipe_saved s, w WHERE s.source = r.source AND NOT s.is_demo AND s.at::date BETWEEN w.d0 AND w.d1)
FROM recipes r JOIN households h ON h.id = r.household_id, w
WHERE r.is_seed = false AND h.is_demo = false AND h.is_probe = false AND r.created_at::date BETWEEN w.d0 AND w.d1
GROUP BY r.source
UNION ALL
-- 6. Nouvelles personnes réelles (owners) vs carnets créés/rejoints dans le journal
SELECT 'nouvelles personnes (owners vs carnet créé/rejoint)',
       (SELECT count(*) FROM owners o, w WHERE owner_is_real(o.id) AND o.created_at::date BETWEEN w.d0 AND w.d1),
       (SELECT count(DISTINCT anon_id) FROM v_onboarding_funnel f, w WHERE f.path IN ('direct', 'invite') AND f.cookbook_at::date BETWEEN w.d0 AND w.d1)
)
SELECT metric, counter, events, events - counter AS diff,
       CASE WHEN counter = 0 AND events = 0 THEN '—'
            WHEN counter = events THEN 'ok'
            WHEN abs(events - counter) <= GREATEST(1, counter / 20) THEN '~ (≤ 5 %)'
            ELSE 'ÉCART' END AS verdict
FROM cmp
ORDER BY metric;
