-- Q1 / campagnes — D'où viennent les appareils qui arrivent, et que deviennent-ils ?
-- `source` = utm_source, sinon navigateur intégré (instagram, messenger…), sinon
-- hôte du referrer, sinon « app » (shell natif) / « direct ». Les liens que TU
-- partages doivent porter des UTM (?utm_source=instagram&utm_medium=bio) : c'est
-- la seule source précise ; le referrer est vide depuis les apps.
SELECT COALESCE(source, '(inconnue)') AS source,
       utm_medium, utm_campaign,
       count(*) AS devices,
       count(*) FILTER (WHERE cookbook_at IS NOT NULL) AS cookbooks,
       count(*) FILTER (WHERE path = 'demo') AS via_demo,
       count(*) FILTER (WHERE first_recipe_at IS NOT NULL) AS first_recipe,
       count(*) FILTER (WHERE third_recipe_at IS NOT NULL) AS third_recipe,
       string_agg(DISTINCT platform, ', ') AS platforms
FROM v_onboarding_funnel
WHERE landing_at >= now() - interval '28 days'
GROUP BY source, utm_medium, utm_campaign
ORDER BY devices DESC;

\echo --- sites d'import et leurs échecs (28 j)
SELECT COALESCE(site, '(inconnu)') AS site,
       count(*) AS attempts,
       count(*) FILTER (WHERE ok) AS ok,
       count(*) FILTER (WHERE NOT ok) AS failed,
       mode() WITHIN GROUP (ORDER BY error_code) FILTER (WHERE NOT ok) AS top_error_code,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms))::numeric) AS median_ms
FROM v_import_extracted
WHERE method = 'url' AND at >= now() - interval '28 days'
GROUP BY site
ORDER BY failed DESC, attempts DESC;
