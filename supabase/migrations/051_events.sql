-- 051 — Journal des événements produit (backlog #28, docs/specs/events/00-socle.md).
--
-- Faits bruts, jamais d'interprétation : trois flux automatiques (écrans,
-- clics, appels API) + trois explicites (impression, erreur affichée, cuisson).
-- Le SENS (« un import a commencé », « la même recette rouverte ») vit dans les
-- vues de la 052, définies a posteriori. Une question nouvelle = une requête
-- sur cette table, jamais une colonne de plus dans stats_daily.
--
-- Identité : `anon_id` = cookie appareil `mijote_aid` posé par le proxy, présent
-- AVANT tout carnet (le funnel d'onboarding se lit par anon_id de bout en bout) ;
-- `owner_id` rattaché dès qu'une session existe (vue v_identity). Contexte
-- (plateforme, version, langue, bras A/B, démo) photographié à l'émission.
-- Sondes (#26) et admin : jamais écrits. Contenu (titre, URL, texte, e-mail) :
-- jamais dans props — identifiants seulement.

CREATE TABLE events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at            timestamptz NOT NULL,                    -- horloge de l'ÉMETTEUR (client ou serveur)
  received_at   timestamptz NOT NULL DEFAULT now(),
  anon_id       uuid NOT NULL,
  owner_id      uuid REFERENCES owners(id) ON DELETE SET NULL,
  device_id     uuid,                                    -- device_sessions.id (pas de FK : survit à la purge)
  household_id  uuid,                                    -- carnet courant, informatif (pas de FK)
  platform      text NOT NULL DEFAULT 'unknown' CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  app_version   text,
  locale        text,
  variant       text,                                    -- bras A/B onboarding (#25)
  is_demo       boolean NOT NULL DEFAULT false,
  source        text NOT NULL CHECK (source IN ('client', 'server')),
  name          text NOT NULL,                           -- catalogue src/lib/events/catalog.ts
  props         jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX events_at_idx       ON events (at DESC);
CREATE INDEX events_owner_at_idx ON events (owner_id, at DESC) WHERE owner_id IS NOT NULL;
CREATE INDEX events_anon_at_idx  ON events (anon_id, at DESC);
CREATE INDEX events_name_at_idx  ON events (name, at DESC);
CREATE INDEX events_props_gin    ON events USING gin (props jsonb_path_ops);

-- Purge à 13 mois (pattern purge_recipe_views, 043), appelée par le cron demo-reset.
CREATE OR REPLACE FUNCTION purge_events(p_keep_days int DEFAULT 400)
RETURNS int
LANGUAGE plpgsql VOLATILE
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  DELETE FROM events WHERE at < now() - make_interval(days => LEAST(GREATEST(p_keep_days, 30), 1100));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Privilèges (règle 039) : lecture/écriture serveur uniquement.
REVOKE ALL ON events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON events TO service_role;
REVOKE ALL ON FUNCTION purge_events(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION purge_events(int) TO service_role;
