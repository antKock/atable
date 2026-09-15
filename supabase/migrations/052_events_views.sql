-- 052 — Le SENS des événements produit (#28, spec §8.1) : chaque « moment »
-- (« un import a commencé », « la même recette rouverte ») est une VUE sur les
-- faits bruts de la 051, jamais un événement émis. Une définition qui change =
-- une migration sans donnée ; une question nouvelle = une requête ad hoc.
--
-- Chaque vue porte en commentaire la question qu'elle sert (Q1…Q8 de la spec).
-- Les cibles `props->>'target'` référencées ici sont vérifiées par
-- src/lib/events/catalog.test.ts : une cible qui n'est plus posée dans le code
-- fait échouer la CI (anti-dérive).

-- ============================================================
-- 1. Identité et sessions
-- ============================================================

-- Personne ← appareil anonyme : le funnel d'onboarding se lit par anon_id de
-- bout en bout, la vue rattache ensuite l'owner.
CREATE VIEW v_identity AS
  SELECT DISTINCT anon_id, owner_id
  FROM events
  WHERE owner_id IS NOT NULL;

-- Chaque événement avec son numéro de session : même anon_id, trou > 30 min
-- ⇒ nouvelle session. Aucune colonne dédiée en base.
CREATE VIEW v_event_sessions AS
  SELECT id, at, received_at, anon_id, owner_id, device_id, household_id,
         platform, app_version, locale, variant, is_demo, source, name, props,
         sum(CASE WHEN prev_at IS NULL OR at - prev_at > interval '30 minutes' THEN 1 ELSE 0 END)
           OVER (PARTITION BY anon_id ORDER BY at, id ROWS UNBOUNDED PRECEDING) AS session_no
  FROM (
    SELECT e.*, lag(at) OVER (PARTITION BY anon_id ORDER BY at, id) AS prev_at
    FROM events e
  ) e;

-- Une ligne par session (Q2, Q6, Q7) : bornes, écrans, plateforme, bras.
CREATE VIEW v_sessions AS
  SELECT anon_id, session_no,
         anon_id::text || ':' || session_no AS session_id,
         min(at) AS started_at,
         max(at) AS ended_at,
         count(*)::int AS n_events,
         count(*) FILTER (WHERE name = 'screen.viewed')::int AS n_screens,
         (array_agg(owner_id) FILTER (WHERE owner_id IS NOT NULL))[1] AS owner_id,
         bool_or(is_demo) AS is_demo,
         max(platform) AS platform,
         max(app_version) AS app_version,
         max(variant) AS variant,
         max(locale) AS locale,
         (array_agg(props->>'route' ORDER BY at, id) FILTER (WHERE name = 'screen.viewed'))[1] AS first_route,
         (array_agg(props->>'route' ORDER BY at DESC, id DESC) FILTER (WHERE name = 'screen.viewed'))[1] AS last_route,
         count(*) FILTER (WHERE name = 'api.called' AND (props->>'status')::int >= 400)::int AS n_api_errors
  FROM v_event_sessions
  GROUP BY anon_id, session_no;

-- ============================================================
-- 2. Écrans et recettes (Q2, Q4, Q6)
-- ============================================================

-- Vue d'écran + durée (le `screen.left` suivant du même écran) + écran précédent.
CREATE VIEW v_screen_views AS
  SELECT v.id, v.at, v.anon_id, v.owner_id, v.session_no, v.platform, v.variant, v.is_demo,
         v.props->>'route' AS route,
         v.props->'params' AS params,
         lag(v.props->>'route') OVER (PARTITION BY v.anon_id, v.session_no ORDER BY v.at, v.id) AS from_route,
         (SELECT (l.props->>'duration_ms')::int
            FROM events l
           WHERE l.anon_id = v.anon_id AND l.name = 'screen.left'
             AND l.at >= v.at AND l.props->>'route' = v.props->>'route'
           ORDER BY l.at, l.id LIMIT 1) AS duration_ms
  FROM v_event_sessions v
  WHERE v.name = 'screen.viewed';

-- Consultation de recette (Q4 : « 5 fois la même ou 5 différentes » = GROUP BY
-- owner_id, recipe_id). `recipe_id` joint `recipes` (source, tags, seed…).
CREATE VIEW v_recipe_views AS
  SELECT id, at, anon_id, owner_id, session_no, platform, is_demo,
         (params->>'id')::uuid AS recipe_id,
         from_route, duration_ms
  FROM v_screen_views
  WHERE route = '/recipes/[id]' AND params->>'id' ~ '^[0-9a-f-]{36}$';

-- Cuisson (Q4) : écran allumé + durée de la consultation correspondante.
CREATE VIEW v_cooking AS
  SELECT c.id, c.at, c.anon_id, c.owner_id, c.session_no, c.platform,
         (c.props->>'recipe_id')::uuid AS recipe_id,
         (SELECT rv.duration_ms FROM v_recipe_views rv
           WHERE rv.anon_id = c.anon_id AND rv.recipe_id = (c.props->>'recipe_id')::uuid
             AND rv.at <= c.at ORDER BY rv.at DESC LIMIT 1) AS duration_ms
  FROM v_event_sessions c
  WHERE c.name = 'recipe.cooking_started' AND c.props->>'recipe_id' ~ '^[0-9a-f-]{36}$';

-- ============================================================
-- 3. Import (Q3)
-- ============================================================

-- Méthode choisie = premier clic sur un panneau d'import.
CREATE VIEW v_import_started AS
  SELECT id, at, anon_id, owner_id, session_no, platform, variant, is_demo,
         CASE props->>'target'
           WHEN 'import.url' THEN 'url'
           WHEN 'import.sample' THEN 'url'
           WHEN 'import.photo' THEN 'photo'
           WHEN 'import.voice' THEN 'voice'
           WHEN 'import.manual' THEN 'manual'
         END AS method,
         props->>'target' = 'import.sample' AS is_sample
  FROM v_event_sessions
  WHERE name = 'ui.clicked'
    AND props->>'target' IN ('import.url', 'import.sample', 'import.photo', 'import.voice', 'import.manual');

-- Extraction IA : issue, durée, CAUSE d'échec (la seule sémantique figée à l'émission).
CREATE VIEW v_import_extracted AS
  SELECT id, at, anon_id, owner_id, session_no, platform, is_demo,
         props->>'method_kind' AS method,
         (props->>'status')::int AS status,
         (props->>'status')::int < 400 AS ok,
         (props->>'duration_ms')::int AS duration_ms,
         props->>'error_code' AS error_code
  FROM v_event_sessions
  WHERE name = 'api.called' AND props->>'route' LIKE '/api/recipes/import/%';

-- Recette enregistrée (toutes méthodes, `source` = méthode d'ajout).
CREATE VIEW v_recipe_saved AS
  SELECT id, at, anon_id, owner_id, session_no, platform, variant, is_demo,
         (props->>'recipe_id')::uuid AS recipe_id,
         props->>'method_kind' AS source
  FROM v_event_sessions
  WHERE name = 'api.called' AND props->>'route' = '/api/recipes'
    AND props->>'method' = 'POST' AND (props->>'status')::int = 201;

-- Funnel d'import par session : commencé → extrait → enregistré. Les trous
-- sont les abandons, avec leur étape.
CREATE VIEW v_import_funnel AS
  SELECT s.anon_id, s.session_no, s.session_id, s.owner_id, s.platform, s.is_demo, s.started_at,
         st.method AS first_method,
         st.n_started, ex.n_extract_ok, ex.n_extract_failed, ex.first_error_code, sv.n_saved,
         CASE
           WHEN COALESCE(sv.n_saved, 0) > 0 THEN 'saved'
           WHEN COALESCE(ex.n_extract_ok, 0) > 0 THEN 'extracted_not_saved'
           WHEN COALESCE(ex.n_extract_failed, 0) > 0 THEN 'extract_failed'
           WHEN st.n_started > 0 THEN 'started_only'
         END AS outcome
  FROM v_sessions s
  JOIN LATERAL (
    SELECT count(*)::int AS n_started,
           (array_agg(method ORDER BY at, id))[1] AS method
    FROM v_import_started i WHERE i.anon_id = s.anon_id AND i.session_no = s.session_no
  ) st ON st.n_started > 0
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE ok)::int AS n_extract_ok,
           count(*) FILTER (WHERE NOT ok)::int AS n_extract_failed,
           (array_agg(error_code ORDER BY at, id) FILTER (WHERE NOT ok))[1] AS first_error_code
    FROM v_import_extracted e WHERE e.anon_id = s.anon_id AND e.session_no = s.session_no
  ) ex ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS n_saved
    FROM v_recipe_saved r WHERE r.anon_id = s.anon_id AND r.session_no = s.session_no
  ) sv ON true;

-- ============================================================
-- 4. Onboarding (Q1, Q6) — par appareil anonyme, de bout en bout
-- ============================================================

CREATE VIEW v_onboarding_funnel AS
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
         i.owner_id
  FROM first_landing l
  LEFT JOIN first_click fc ON fc.anon_id = l.anon_id
  LEFT JOIN cookbook c ON c.anon_id = l.anon_id
  LEFT JOIN saved s ON s.anon_id = l.anon_id
  LEFT JOIN LATERAL (SELECT owner_id FROM v_identity vi WHERE vi.anon_id = l.anon_id LIMIT 1) i ON true;

-- ============================================================
-- 5. Partage et foyer (Q5)
-- ============================================================

-- Lien créé → ouvert par un AUTRE appareil → copié dans son carnet.
CREATE VIEW v_share_loop AS
  SELECT c.id, c.at AS created_at, c.anon_id AS sharer_anon_id, c.owner_id AS sharer_owner_id,
         (c.props->>'recipe_id')::uuid AS recipe_id,
         r.share_token,
         (SELECT count(DISTINCT o.anon_id)::int FROM events o
           WHERE o.name = 'screen.viewed' AND o.props->>'route' = '/r/[token]'
             AND o.props->'params'->>'token' = r.share_token AND o.anon_id <> c.anon_id AND o.at >= c.at) AS n_openers,
         (SELECT count(DISTINCT k.anon_id)::int FROM events k
           WHERE k.name = 'ui.clicked' AND k.props->>'target' = 'share.copy_to_mine'
             AND k.anon_id <> c.anon_id AND k.at >= c.at
             AND EXISTS (SELECT 1 FROM events o WHERE o.anon_id = k.anon_id AND o.name = 'screen.viewed'
                           AND o.props->>'route' = '/r/[token]' AND o.props->'params'->>'token' = r.share_token)) AS n_copiers
  FROM events c
  LEFT JOIN recipes r ON r.id = (c.props->>'recipe_id')::uuid
  WHERE c.name = 'api.called' AND c.props->>'route' = '/api/recipes/[id]/share'
    AND c.props->>'method' = 'POST' AND (c.props->>'status')::int < 300
    AND c.props->>'recipe_id' ~ '^[0-9a-f-]{36}$';

-- Arrivée par invitation : lien (/join/[code] vu avant) ou code saisi.
CREATE VIEW v_household_joins AS
  SELECT j.id, j.at, j.anon_id, j.owner_id, j.platform, j.variant, j.session_no,
         CASE WHEN EXISTS (SELECT 1 FROM events o WHERE o.anon_id = j.anon_id AND o.name = 'screen.viewed'
                             AND o.props->>'route' = '/join/[code]' AND o.at <= j.at)
              THEN 'link' ELSE 'code' END AS via
  FROM v_event_sessions j
  WHERE j.name = 'api.called' AND j.props->>'route' = '/api/households/join'
    AND j.props->>'method' = 'POST' AND (j.props->>'status')::int < 300;

-- Privilèges (règle 039) : lecture serveur uniquement.
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['v_identity', 'v_event_sessions', 'v_sessions', 'v_screen_views',
                           'v_recipe_views', 'v_cooking', 'v_import_started', 'v_import_extracted',
                           'v_recipe_saved', 'v_import_funnel', 'v_onboarding_funnel',
                           'v_share_loop', 'v_household_joins']
  LOOP
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC, anon, authenticated', v);
    EXECUTE format('GRANT SELECT ON %I TO service_role', v);
  END LOOP;
END $$;
