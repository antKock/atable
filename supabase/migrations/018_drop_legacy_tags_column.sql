-- Migration 018: drop the legacy recipes.tags (TEXT[]) column.
--
-- ⚠️ Apply only AFTER deploying the code that no longer selects this column
-- (mappers.ts fallback removed, select clauses cleaned) — older code SELECTs
-- `tags` explicitly and would 500 on every recipe list otherwise.
-- Data was backfilled into tags/recipe_tags by migration 017.

ALTER TABLE recipes DROP COLUMN IF EXISTS tags;
