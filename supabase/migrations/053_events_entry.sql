-- 053 — Origine d'entrée et site d'import (#28, suite de la 052).
--
-- La première vue d'écran d'un chargement porte `props.entry` (referrer_host,
-- utm_*, in_app, click_id) ; l'import par URL porte `props.site`. Deux vues :
-- l'entrée par appareil, et le funnel d'onboarding enrichi de la source.

-- Première entrée connue d'un appareil : d'où vient la personne, pour ce que
-- le navigateur en dit (Q1, campagnes). NULL partout = shell natif ou direct.
CREATE VIEW v_entries AS
  SELECT DISTINCT ON (anon_id) anon_id, at AS entered_at, platform, variant,
         props->>'route' AS route,
         props->'entry'->>'referrer_host' AS referrer_host,
         props->'entry'->>'utm_source' AS utm_source,
         props->'entry'->>'utm_medium' AS utm_medium,
         props->'entry'->>'utm_campaign' AS utm_campaign,
         props->'entry'->>'in_app' AS in_app,
         props->'entry'->>'click_id' AS click_id,
         COALESCE(props->'entry'->>'utm_source', props->'entry'->>'in_app',
                  props->'entry'->>'referrer_host',
                  CASE WHEN platform IN ('ios', 'android') THEN 'app' ELSE 'direct' END) AS source
  FROM events
  WHERE name = 'screen.viewed' AND source = 'client'
  ORDER BY anon_id, (props ? 'entry') DESC, at, id;

-- Funnel d'onboarding + source (colonnes ajoutées en fin : CREATE OR REPLACE).
CREATE OR REPLACE VIEW v_onboarding_funnel AS
  WITH first_landing AS (
    SELECT anon_id, min(at) AS landing_at,
           (array_agg(variant ORDER BY at, id))[1] AS variant,
           (array_agg(platform ORDER BY at, id))[1] AS platform
    FROM events WHERE name = 'screen.viewed' AND props->>'route' = '/'
    GROUP BY anon_id
  ),
  first_click AS (
    SELECT anon_id, (array_agg(props->>'target' ORDER BY at, id))[1] AS first_landing_click
    FROM events WHERE name = 'ui.clicked' AND props->>'target' LIKE 'landing.%'
    GROUP BY anon_id
  ),
  cookbook AS (
    SELECT anon_id, min(at) AS cookbook_at,
           (array_agg(CASE props->>'route'
                        WHEN '/api/households' THEN 'direct'
                        WHEN '/api/demo/session' THEN 'demo'
                        WHEN '/api/households/join' THEN 'invite'
                      END ORDER BY at, id))[1] AS path
    FROM events
    WHERE name = 'api.called' AND props->>'method' = 'POST' AND (props->>'status')::int < 300
      AND props->>'route' IN ('/api/households', '/api/demo/session', '/api/households/join')
    GROUP BY anon_id
  ),
  saved AS (
    SELECT anon_id,
           min(at) AS first_recipe_at,
           (array_agg(at ORDER BY at))[3] AS third_recipe_at,
           count(*)::int AS n_recipes
    FROM v_recipe_saved WHERE NOT is_demo
    GROUP BY anon_id
  )
  SELECT l.anon_id, l.landing_at, l.variant, l.platform,
         fc.first_landing_click,
         c.cookbook_at, c.path,
         s.first_recipe_at, s.third_recipe_at, COALESCE(s.n_recipes, 0) AS n_recipes,
         i.owner_id,
         e.source, e.referrer_host, e.utm_source, e.utm_medium, e.utm_campaign, e.in_app, e.click_id
  FROM first_landing l
  LEFT JOIN first_click fc ON fc.anon_id = l.anon_id
  LEFT JOIN cookbook c ON c.anon_id = l.anon_id
  LEFT JOIN saved s ON s.anon_id = l.anon_id
  LEFT JOIN LATERAL (SELECT owner_id FROM v_identity vi WHERE vi.anon_id = l.anon_id LIMIT 1) i ON true
  LEFT JOIN v_entries e ON e.anon_id = l.anon_id;

-- Import par URL : le site (v_import_extracted enrichie, colonne en fin).
CREATE OR REPLACE VIEW v_import_extracted AS
  SELECT id, at, anon_id, owner_id, session_no, platform, is_demo,
         props->>'method_kind' AS method,
         (props->>'status')::int AS status,
         (props->>'status')::int < 400 AS ok,
         (props->>'duration_ms')::int AS duration_ms,
         props->>'error_code' AS error_code,
         props->>'site' AS site
  FROM v_event_sessions
  WHERE name = 'api.called' AND props->>'route' LIKE '/api/recipes/import/%';

REVOKE ALL ON v_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON v_entries TO service_role;
-- v_onboarding_funnel / v_import_extracted : CREATE OR REPLACE conserve les privilèges de la 052.
