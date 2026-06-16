-- Migration 019: OpenAI API cost instrumentation.
--
-- One row per billable OpenAI call, written by src/lib/ai-cost.ts. Powers the
-- "Coût IA" dashboard section: spend by usage type (OCR / metadata / image /
-- import) and per recipe. All amounts in USD (OpenAI's billing currency).
--
-- recipe_id is NULL for calls made before a recipe exists (screenshot OCR,
-- URL/voice import parse, transcription — the import may never be saved). It is
-- set for enrichment calls (metadata, image_prompt, image), enabling per-recipe
-- cost. household_id is always known (from the authenticated session).

CREATE TABLE ai_costs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id     UUID        REFERENCES recipes(id) ON DELETE SET NULL,
  call_type     TEXT        NOT NULL,   -- ocr|metadata|image|image_prompt|import_url|import_voice|transcription
  model         TEXT        NOT NULL,
  input_tokens  INT,
  output_tokens INT,
  cost_usd      NUMERIC(12, 6) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_costs_created_at   ON ai_costs (created_at);
CREATE INDEX idx_ai_costs_household    ON ai_costs (household_id);
CREATE INDEX idx_ai_costs_recipe       ON ai_costs (recipe_id);
CREATE INDEX idx_ai_costs_call_type    ON ai_costs (call_type);

-- All DB access is server-side via the service role (which bypasses RLS).
-- Enable RLS with no policy to deny the public anon key, consistent with 008.
ALTER TABLE ai_costs ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- Daily spend by call type (trend chart). Demo/test households excluded, same
-- predicate as the other analytics_* functions (see 012).
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics_ai_cost_daily(p_days int DEFAULT 90)
RETURNS TABLE (day date, call_type text, cost_usd numeric, calls bigint)
LANGUAGE sql STABLE AS $$
  SELECT c.created_at::date AS day,
         c.call_type,
         sum(c.cost_usd)     AS cost_usd,
         count(*)            AS calls
  FROM ai_costs c
  JOIN households h ON h.id = c.household_id
  WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%')
    AND c.created_at::date >= current_date - p_days
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

-- --------------------------------------------------------------------------
-- Spend summary over a window: totals by usage group + per-recipe / per-image
-- unit economics. One row.
--   cost_per_recipe = recipe-linked spend (metadata+image+image_prompt) over
--                     the number of distinct recipes that incurred cost.
--   cost_per_image  = image spend over the number of images generated.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics_ai_cost_summary(p_days int DEFAULT 30)
RETURNS TABLE (
  total_usd        numeric,
  ocr_usd          numeric,
  metadata_usd     numeric,
  image_usd        numeric,
  import_usd       numeric,
  calls_total      bigint,
  recipes_costed   bigint,
  recipe_linked_usd numeric,
  images_count     bigint,
  cost_per_recipe  numeric,
  cost_per_image   numeric
)
LANGUAGE sql STABLE AS $$
  WITH c AS (
    SELECT c.*
    FROM ai_costs c
    JOIN households h ON h.id = c.household_id
    WHERE (h.is_demo = false AND h.name NOT ILIKE 'test%')
      AND c.created_at::date >= current_date - p_days
  )
  SELECT
    COALESCE(sum(cost_usd), 0),
    COALESCE(sum(cost_usd) FILTER (WHERE call_type = 'ocr'), 0),
    COALESCE(sum(cost_usd) FILTER (WHERE call_type = 'metadata'), 0),
    COALESCE(sum(cost_usd) FILTER (WHERE call_type = 'image'), 0),
    COALESCE(sum(cost_usd) FILTER (WHERE call_type IN ('import_url', 'import_voice', 'transcription')), 0),
    count(*),
    count(DISTINCT recipe_id) FILTER (WHERE recipe_id IS NOT NULL),
    COALESCE(sum(cost_usd) FILTER (WHERE recipe_id IS NOT NULL), 0),
    count(*) FILTER (WHERE call_type = 'image'),
    COALESCE(sum(cost_usd) FILTER (WHERE recipe_id IS NOT NULL), 0)
      / NULLIF(count(DISTINCT recipe_id) FILTER (WHERE recipe_id IS NOT NULL), 0),
    COALESCE(sum(cost_usd) FILTER (WHERE call_type = 'image'), 0)
      / NULLIF(count(*) FILTER (WHERE call_type = 'image'), 0)
  FROM c;
$$;
