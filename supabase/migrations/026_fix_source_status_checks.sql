-- 026: corrige les CHECK de la 025 — valeurs manquantes écrites par la copie
-- de recette partagée (POST /api/recipes/copy, depuis la 013) :
--   * recipes.source = 'shared'
--   * recipes.enrichment_status = 'done' et recipes.image_status = 'done'
-- Sans quoi la copie échoue en 500, et tout UPDATE d'une recette copiée avant
-- la 025 est rejeté (un CHECK NOT VALID s'applique à chaque nouvelle version
-- de ligne, pas seulement aux INSERT).
-- Découvert par le harnais E2E du pré-lot foyer (e2e/06-share.spec.ts).

ALTER TABLE recipes DROP CONSTRAINT recipes_source_check;
ALTER TABLE recipes
  ADD CONSTRAINT recipes_source_check
  CHECK (source IN ('manual', 'url', 'photo', 'voice', 'shared', 'unknown'))
  NOT VALID;

ALTER TABLE recipes DROP CONSTRAINT recipes_enrichment_status_check;
ALTER TABLE recipes
  ADD CONSTRAINT recipes_enrichment_status_check
  CHECK (enrichment_status IN ('none', 'pending', 'enriched', 'failed', 'done'))
  NOT VALID;

ALTER TABLE recipes DROP CONSTRAINT recipes_image_status_check;
ALTER TABLE recipes
  ADD CONSTRAINT recipes_image_status_check
  CHECK (image_status IN ('none', 'pending', 'generated', 'failed', 'done'))
  NOT VALID;
