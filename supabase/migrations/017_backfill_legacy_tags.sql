-- Migration 017: backfill the legacy recipes.tags (TEXT[]) column into the
-- relational model (tags + recipe_tags).
--
-- Migration 004 introduced the relational model but never migrated existing
-- TEXT[] data, and seed.sql kept writing the legacy column for demo recipes —
-- so mappers.ts had to support both formats. This backfill makes the
-- relational model the single source of truth; migration 018 then drops the
-- column. Safe to run at any time: the app prefers relational tags whenever
-- they exist, and names are unchanged.
--
-- Matching is case-insensitive against predefined tags (household_id IS NULL)
-- and the recipe's own household tags; unmatched names become custom
-- household-scoped tags, mirroring what POST /api/tags does.

-- Step 1: create the missing tags.
-- (Separate statement from step 2: rows inserted by a data-modifying CTE are
-- not visible to the rest of the same statement.)
WITH legacy AS (
  SELECT r.id AS recipe_id, r.household_id, trim(name) AS name
  FROM recipes r, unnest(r.tags) AS name
  WHERE r.tags IS NOT NULL AND cardinality(r.tags) > 0
)
INSERT INTO tags (name, category, is_predefined, household_id)
SELECT DISTINCT l.name, NULL, false, l.household_id
FROM legacy l
WHERE l.name <> ''
  AND l.household_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tags tg
    WHERE lower(tg.name) = lower(l.name)
      AND (tg.household_id IS NULL OR tg.household_id = l.household_id)
  )
ON CONFLICT (name, household_id) DO NOTHING;

-- Step 2: link recipes to their tags (prefer the predefined tag on collision).
WITH legacy AS (
  SELECT r.id AS recipe_id, r.household_id, trim(name) AS name
  FROM recipes r, unnest(r.tags) AS name
  WHERE r.tags IS NOT NULL AND cardinality(r.tags) > 0
)
INSERT INTO recipe_tags (recipe_id, tag_id)
SELECT l.recipe_id, match.id
FROM legacy l
JOIN LATERAL (
  SELECT tg.id
  FROM tags tg
  WHERE lower(tg.name) = lower(l.name)
    AND (tg.household_id IS NULL OR tg.household_id = l.household_id)
  ORDER BY tg.is_predefined DESC
  LIMIT 1
) match ON true
WHERE l.name <> ''
ON CONFLICT DO NOTHING;
