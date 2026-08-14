-- Migration 034: attribution d'acquisition (campagne Insta test 10 $, 2026-08).
--
-- Aucune couche ne captait d'où vient un visiteur : un essai démo issu d'une
-- pub Instagram était indistinguable d'un essai organique. Les UTM de l'URL
-- d'arrivée sont capturés sur la landing (localStorage) puis persistés :
--
--   - device_sessions.acquisition : posée à la création de la session démo
--     (« Essayer l'app ») — le grain que compte analytics_demo_funnel.
--     ⚠ Les owners démo sont purgés à 30 j (cascade sessions) : la lecture
--     par source doit se faire pendant / juste après la fenêtre de campagne.
--   - households.acquisition : posée à la création du carnet — envoyée par le
--     client (création directe depuis la landing) ou héritée côté serveur de
--     la session démo à la conversion. Pérenne (les carnets ne sont pas purgés).
--
-- Format : {"source": "instagram", "campaign": "test10-2026-08", "content": "A"}
-- (clés allow-listées et tronquées côté serveur — routes non authentifiées).

ALTER TABLE device_sessions ADD COLUMN acquisition JSONB;
ALTER TABLE households ADD COLUMN acquisition JSONB;

-- Essais démo et carnets créés par source sur une fenêtre. La ligne
-- « (organique) » (acquisition NULL) donne le plancher hors campagne — c'est
-- la base de comparaison des critères de lecture de la campagne.
CREATE OR REPLACE FUNCTION analytics_acquisition_sources(p_days int DEFAULT 30)
RETURNS TABLE (source text, campaign text, content text, trials bigint, carnets bigint)
LANGUAGE sql STABLE AS $$
  WITH t AS (
    SELECT COALESCE(ds.acquisition->>'source', '(organique)') AS source,
           ds.acquisition->>'campaign' AS campaign,
           ds.acquisition->>'content' AS content,
           count(*) AS trials
    FROM device_sessions ds
    JOIN households h ON h.id = ds.household_id
    WHERE h.is_demo AND ds.created_at::date >= current_date - (p_days - 1)
    GROUP BY 1, 2, 3
  ),
  c AS (
    SELECT COALESCE(hh.acquisition->>'source', '(organique)') AS source,
           hh.acquisition->>'campaign' AS campaign,
           hh.acquisition->>'content' AS content,
           count(*) AS carnets
    FROM households hh
    WHERE NOT hh.is_demo
      AND hh.name NOT ILIKE 'test%'
      AND hh.origin IN ('landing', 'demo_conversion')
      AND hh.created_at::date >= current_date - (p_days - 1)
    GROUP BY 1, 2, 3
  )
  SELECT COALESCE(t.source, c.source),
         COALESCE(t.campaign, c.campaign),
         COALESCE(t.content, c.content),
         COALESCE(t.trials, 0)::bigint,
         COALESCE(c.carnets, 0)::bigint
  FROM t
  FULL OUTER JOIN c
    ON c.source = t.source
   AND c.campaign IS NOT DISTINCT FROM t.campaign
   AND c.content IS NOT DISTINCT FROM t.content
  ORDER BY 4 DESC, 5 DESC;
$$;
