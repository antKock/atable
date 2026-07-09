-- 025: Data integrity — missing indexes + CHECK constraints on enum-like columns.
--
-- Safe to apply BEFORE deploying code (nothing here changes what the current
-- code reads or writes): the indexes are additive, and every CHECK matches the
-- exact vocabulary the server already writes.
--
-- CHECKs are NOT VALID: they are enforced on every new INSERT/UPDATE but do
-- not scan existing rows, so the migration cannot fail on legacy data. Once
-- verified clean, each can be upgraded with:
--   ALTER TABLE <t> VALIDATE CONSTRAINT <name>;

-- ============================================================
-- 1. Missing indexes
-- ============================================================

-- recipe_tags PK is (recipe_id, tag_id): lookups and cascading deletes by tag
-- (DELETE on tags, "recipes carrying this tag" in filters/carousels) scanned
-- the whole table.
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON recipe_tags(tag_id);

-- FK recipes.created_by_device_id is ON DELETE SET NULL (008): every
-- device_sessions delete seq-scanned recipes without this.
CREATE INDEX IF NOT EXISTS idx_recipes_created_by_device_id
  ON recipes(created_by_device_id);

-- ============================================================
-- 2. CHECK constraints — enum-like TEXT columns
-- ============================================================
-- Until now these vocabularies lived only in comments and TS types: a typo'd
-- category ('import_instagam') was accepted in DB and silently vanished from
-- every dashboard aggregate. A CHECK turns that into a loud write error.

-- recipes.source — RECIPE_SOURCES (schemas/recipe.ts) + 'unknown' legacy (008)
ALTER TABLE recipes
  ADD CONSTRAINT recipes_source_check
  CHECK (source IN ('manual', 'url', 'photo', 'voice', 'unknown'))
  NOT VALID;

-- recipes.enrichment_status / image_status — lib/enrichment.ts
ALTER TABLE recipes
  ADD CONSTRAINT recipes_enrichment_status_check
  CHECK (enrichment_status IN ('none', 'pending', 'enriched', 'failed'))
  NOT VALID;

ALTER TABLE recipes
  ADD CONSTRAINT recipes_image_status_check
  CHECK (image_status IN ('none', 'pending', 'generated', 'failed'))
  NOT VALID;

-- recipes.complexity — VALID_COMPLEXITY_LEVELS (schemas/enrichment.ts); nullable
ALTER TABLE recipes
  ADD CONSTRAINT recipes_complexity_check
  CHECK (complexity IS NULL OR complexity IN ('facile', 'moyen', 'difficile'))
  NOT VALID;

-- device_sessions.platform — VALID_PLATFORMS (api/activity/ping) + 'unknown'
ALTER TABLE device_sessions
  ADD CONSTRAINT device_sessions_platform_check
  CHECK (platform IN ('ios', 'android', 'web', 'unknown'))
  NOT VALID;

-- daily_activity.platform (nullable) / origin — 008 + backfill script
ALTER TABLE daily_activity
  ADD CONSTRAINT daily_activity_platform_check
  CHECK (platform IS NULL OR platform IN ('ios', 'android', 'web', 'unknown'))
  NOT VALID;

ALTER TABLE daily_activity
  ADD CONSTRAINT daily_activity_origin_check
  CHECK (origin IN ('ping', 'backfill_household', 'backfill_session', 'backfill_recipe'))
  NOT VALID;

-- ai_costs.call_type — AiCallType (lib/ai-cost.ts); this is the column whose
-- silent-typo failure mode motivated the whole batch (020's FILTER clauses).
ALTER TABLE ai_costs
  ADD CONSTRAINT ai_costs_call_type_check
  CHECK (call_type IN (
    'ocr', 'metadata', 'image', 'image_prompt',
    'import_url', 'import_instagram', 'import_url_crawler',
    'import_voice', 'transcription'
  ))
  NOT VALID;
