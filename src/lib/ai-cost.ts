import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// OpenAI API cost instrumentation. Every billable call records a row in
// `ai_costs` (model, tokens, USD) so the stats dashboard can break spend down
// by usage type and per recipe — all in USD, the currency OpenAI bills in.
//
// Prices are list rates (USD). Token-priced models are exact; image generation
// is a flat per-image rate grounded in observed billing. The dashboard also
// pulls the org-level Costs API as a ground-truth reconciliation, so small
// drift here (retries, rounding) is caught rather than hidden.
// ---------------------------------------------------------------------------

// What a call was for. The dashboard groups these into OCR / metadata / image /
// import for display (see analytics_ai_cost_* RPCs).
// Models per role live in ai-models.ts (AI_MODELS.text/vision/transcription/image).
export type AiCallType =
  | "ocr" // screenshot extraction (vision model)
  | "metadata" // recipe enrichment: tags, times, cost, seasons (text model)
  | "image" // dish image generation (image model)
  | "image_prompt" // image-prompt authoring before generation (text model)
  | "import_url" // recipe parse from a directly-fetched web page (text model)
  | "import_instagram" // recipe parse from an Instagram caption (text model); also an Apify scrape row
  | "import_url_crawler" // recipe parse via Apify headless crawler fallback (text model); also an Apify scrape row
  | "import_voice" // recipe parse from a voice transcription (text model)
  | "transcription"; // voice → text (transcription model)

// USD per 1M tokens, for token-billed models. Keep an entry for every model
// referenced in ai-models.ts (current or candidate) — unknown models price at 0
// and silently under-report spend in the dashboard.
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-5.6-sol": { input: 4, output: 20 },
  "gpt-5.6-terra": { input: 2, output: 12 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
};

// Flat USD per generated image, keyed by `quality:size`. Grounded in observed
// gpt-image-1.5 billing (~$0.0109 all-in for low/1024² incl. text tokens).
const IMAGE_PRICING: Record<string, number> = {
  "low:1024x1024": 0.011,
  "medium:1024x1024": 0.042,
  "high:1024x1024": 0.167,
};

// USD per second of audio (whisper-1 is $0.006/min).
const WHISPER_USD_PER_SECOND = 0.006 / 60;

/** Cost of a token-billed chat/vision call. Unknown models price at 0. */
export function textCostUsd(
  model: string,
  inputTokens = 0,
  outputTokens = 0,
): number {
  const p = TOKEN_PRICING[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

/** Flat cost of one generated image. Unknown quality/size prices at 0. */
export function imageCostUsd(quality: string, size: string): number {
  return IMAGE_PRICING[`${quality}:${size}`] ?? 0;
}

/** Cost of a whisper transcription given the audio duration in seconds. */
export function transcriptionCostUsd(audioSeconds: number): number {
  return Math.max(0, audioSeconds) * WHISPER_USD_PER_SECOND;
}

export type AiCostRecord = {
  householdId: string;
  recipeId?: string | null;
  callType: AiCallType;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd: number;
};

/**
 * Persist one cost row. Best-effort: never throws into the calling flow — a
 * failed metering insert must not break import or enrichment. Callers `await`
 * it so the write completes before a serverless function freezes.
 */
export async function recordAiCost(rec: AiCostRecord): Promise<void> {
  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("ai_costs").insert({
      household_id: rec.householdId,
      recipe_id: rec.recipeId ?? null,
      call_type: rec.callType,
      model: rec.model,
      input_tokens: rec.inputTokens ?? null,
      output_tokens: rec.outputTokens ?? null,
      cost_usd: rec.costUsd,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    Sentry.captureException(err);
    console.error("[ai-cost] failed to record cost:", err);
  }
}
