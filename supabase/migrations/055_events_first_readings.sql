-- 055 — Premières lectures prod du journal (#28, 2026-09-16, 2 664 événements).
--
-- 1. v_cooking : « on cuisine » = une fiche restée ouverte ≥ 2 min. L'événement
--    explicite `recipe.cooking_started` (wake lock) partait à CHAQUE ouverture de
--    fiche (113 pour 115 vues) : il doublait screen.viewed, il n'est plus émis.
-- 2. v_sessions.platform : la plateforme majoritaire hors `unknown` — `max()`
--    prenait `unknown` dès qu'un appel public (création de carnet, anonyme)
--    figurait dans la session, ce qui vidait la question Q7.

-- (CREATE OR REPLACE : mêmes colonnes dans le même ordre, ajouts en fin.)
CREATE OR REPLACE VIEW v_cooking AS
  SELECT id, at, anon_id, owner_id, session_no, platform, recipe_id, duration_ms, is_demo, from_route
  FROM v_recipe_views
  WHERE duration_ms >= 120000;

CREATE OR REPLACE VIEW v_sessions AS
  SELECT anon_id, session_no,
         anon_id::text || ':' || session_no AS session_id,
         min(at) AS started_at,
         max(at) AS ended_at,
         count(*)::int AS n_events,
         count(*) FILTER (WHERE name = 'screen.viewed')::int AS n_screens,
         (array_agg(owner_id) FILTER (WHERE owner_id IS NOT NULL))[1] AS owner_id,
         bool_or(is_demo) AS is_demo,
         COALESCE(mode() WITHIN GROUP (ORDER BY platform) FILTER (WHERE platform <> 'unknown'), 'unknown') AS platform,
         max(app_version) AS app_version,
         max(variant) AS variant,
         max(locale) AS locale,
         (array_agg(props->>'route' ORDER BY at, id) FILTER (WHERE name = 'screen.viewed'))[1] AS first_route,
         (array_agg(props->>'route' ORDER BY at DESC, id DESC) FILTER (WHERE name = 'screen.viewed'))[1] AS last_route,
         count(*) FILTER (WHERE name = 'api.called' AND (props->>'status')::int >= 400)::int AS n_api_errors
  FROM v_event_sessions
  GROUP BY anon_id, session_no;
-- CREATE OR REPLACE conserve les privilèges de la 052.
