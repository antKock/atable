-- 056 — Conservation 30 jours des envois d'import (docs/specs/ocr-appareil/01-conservation-imports.md).
--
-- Ce que la personne envoie pour importer une recette (photos, dictée, lien et
-- texte de la page) est gardé 30 jours dans un bucket PRIVÉ, avec ce que l'IA en
-- a tiré, pour reproduire les erreurs et tester les imports. Refus possible
-- (owners.import_pool_opt_out), qui supprime aussi ce qui a été gardé.
--
-- Les fichiers vivent hors base (bucket) : aucune cascade ne les atteint. D'où
-- les FK en SET NULL sur owner et foyer — une ligne orpheline (profil fusionné,
-- carnet supprimé par une voie qui n'a pas purgé) est ramassée, fichiers
-- compris, par la purge nocturne du cron demo-reset (l'app supprime les objets
-- du bucket, puis les lignes).

ALTER TABLE owners ADD COLUMN import_pool_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE import_samples (
  id            uuid PRIMARY KEY,                                   -- sampleId, tiré par l'app et renvoyé au client
  owner_id      uuid REFERENCES owners(id) ON DELETE SET NULL,
  household_id  uuid REFERENCES households(id) ON DELETE SET NULL,
  recipe_id     uuid REFERENCES recipes(id) ON DELETE SET NULL,      -- rattaché à l'enregistrement
  method        text NOT NULL CHECK (method IN ('photo', 'voice', 'url')),
  files         text[] NOT NULL DEFAULT '{}',                       -- chemins dans le bucket privé
  status        int  NOT NULL,                                      -- statut HTTP de l'import
  error_code    text,                                               -- EXTRACTION_FAILED, SITE_BLOCKED…
  url           text,                                               -- lien : adresse importée
  path          text,                                               -- voie de lecture (import_url, import_instagram, import_url_crawler…)
  image_kind    text,                                               -- photo : `kind` de gpt-4o
  transcript    text,                                               -- dictée : transcription brute
  extracted     jsonb,                                              -- recette extraite (null en échec)
  model         text,                                               -- modèle(s) utilisé(s), pour rejouer à l'identique
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '30 days'
);

CREATE INDEX import_samples_expires_idx ON import_samples (expires_at);
CREATE INDEX import_samples_owner_idx ON import_samples (owner_id, created_at DESC);
CREATE INDEX import_samples_household_idx ON import_samples (household_id);

-- Même modèle que 027/051 : RLS activée sans policy, service role uniquement.
ALTER TABLE import_samples ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON import_samples FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON import_samples TO service_role;
