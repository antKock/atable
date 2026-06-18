-- Migration 020: split the AI-cost "import" bucket into its distinct voies.
--
-- URL imports now flow through three paths, each with its own call_type:
--   import_url           — direct server-side fetch (free)
--   import_instagram     — Instagram caption via Apify
--   import_url_crawler   — Apify headless-crawler fallback for blocked sites
-- The Apify scrape itself also records a row (model 'apify:*') under the same
-- call_type, so the dashboard reflects real Apify spend, not just GPT cost.
--
-- The daily trend RPC (analytics_ai_cost_daily) already groups by call_type, so
-- it needs no change. Only the summary RPC, which exposed a single import_usd
-- column, is widened. A return-type change requires DROP + CREATE.

DROP FUNCTION IF EXISTS analytics_ai_cost_summary(int);

CREATE OR REPLACE FUNCTION analytics_ai_cost_summary(p_days int DEFAULT 30)
RETURNS TABLE (
  total_usd            numeric,
  ocr_usd              numeric,
  metadata_usd         numeric,
  image_usd            numeric,
  import_url_usd        numeric,
  import_instagram_usd  numeric,
  import_crawler_usd    numeric,
  import_voice_usd      numeric,
  calls_total          bigint,
  recipes_costed       bigint,
  recipe_linked_usd    numeric,
  images_count         bigint,
  cost_per_recipe      numeric,
  cost_per_image       numeric
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
    COALESCE(sum(cost_usd) FILTER (WHERE call_type = 'import_url'), 0),
    COALESCE(sum(cost_usd) FILTER (WHERE call_type = 'import_instagram'), 0),
    COALESCE(sum(cost_usd) FILTER (WHERE call_type = 'import_url_crawler'), 0),
    COALESCE(sum(cost_usd) FILTER (WHERE call_type IN ('import_voice', 'transcription')), 0),
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
