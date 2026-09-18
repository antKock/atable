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

// What a call was for. Le dashboard v3 (src/lib/admin/v3) regroupe ces types en
// OCR / métadonnées / image / import à l'affichage.
// Models per role live in ai-models.ts (AI_MODELS.text/vision/transcription/image).
export type AiCallType =
  | "ocr" // screenshot extraction (vision model)
  | "metadata" // recipe enrichment: tags, times, cost, seasons (text model)
  | "image" // dish image generation (image model)
  | "image_prompt" // image-prompt authoring before generation (text model)
  | "import_url" // recipe parse from a directly-fetched web page (text model)
  | "import_instagram" // recipe parse from an Instagram caption (text model); plus an Apify row (0 $, free plan) only when Apify was the fallback
  | "import_url_crawler" // recipe parse via Apify headless crawler fallback (text model); also an Apify row (0 $, free plan)
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

/**
 * Modèles facturés autrement qu'au token, avec la raison — l'invariant testé
 * (ai-cost.test.ts) exige que chaque entrée de AI_MODELS soit soit tarifée
 * dans TOKEN_PRICING, soit listée ici explicitement. Ajouter un modèle sans
 * prix = spend sous-déclaré en silence dans le dashboard.
 */
export const NON_TOKEN_PRICED_MODELS: Record<string, string> = {
  "gpt-image-2.5-flare": "forfait par image (IMAGE_PRICING, qualité:taille)",
  "gpt-4o-mini-transcribe":
    "facturé à la seconde d'audio, durée inconnue côté serveur : ligne à 0 $ (compteur), réconciliée par la Costs API",
};

/** Un modèle est-il tarifé au token (entrée dans TOKEN_PRICING) ? */
export function hasTokenPricing(model: string): boolean {
  return model in TOKEN_PRICING;
}

// Flat USD per generated image, keyed by `quality:size`, for AI_MODELS.image
// (gpt-image-2.5-flare). Tokens mesurés le 2026-09-18 × tarif public (texte en
// entrée 5 $/1M, ~110 tokens ; image en sortie 30 $/1M) : 196 / 439 / 1 756
// tokens image en low / medium / high. Pas de sortie texte facturée, contrairement
// à gpt-image-1.5 (~143 tokens à 10 $/1M). À re-mesurer si le modèle change.
const IMAGE_PRICING: Record<string, number> = {
  "low:1024x1024": 0.0064,
  "medium:1024x1024": 0.014,
  "high:1024x1024": 0.053,
};

/** Cost of a token-billed chat/vision call. Unknown models price at 0. */
export function textCostUsd(model: string, inputTokens = 0, outputTokens = 0): number {
  const p = TOKEN_PRICING[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

/** Flat cost of one generated image. Unknown quality/size prices at 0. */
export function imageCostUsd(quality: string, size: string): number {
  return IMAGE_PRICING[`${quality}:${size}`] ?? 0;
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
    const row = {
      household_id: rec.householdId,
      recipe_id: rec.recipeId ?? null,
      call_type: rec.callType,
      model: rec.model,
      input_tokens: rec.inputTokens ?? null,
      output_tokens: rec.outputTokens ?? null,
      cost_usd: rec.costUsd,
    };
    let { error } = await supabase.from("ai_costs").insert(row);
    // Enrichment runs after the response (`after()`), so the user may have
    // deleted the recipe before its image finished generating. The cost is
    // still real: keep the row, just drop the dangling recipe_id (23503 =
    // foreign_key_violation) instead of losing it and paging Sentry.
    if (error?.code === "23503" && row.recipe_id) {
      console.warn("[ai-cost] recipe gone before cost recorded — keeping row without recipe_id");
      ({ error } = await supabase.from("ai_costs").insert({ ...row, recipe_id: null }));
    }
    // Same race one level up: the household itself was deleted while the
    // enrichment was still running (seen on staging, 2026-09-12). household_id
    // is NOT NULL and the row would be cascaded away anyway — drop it, no page.
    if (error?.code === "23503") {
      console.warn("[ai-cost] household gone before cost recorded — row dropped");
      return;
    }
    if (error) throw new Error(error.message);
  } catch (err) {
    Sentry.captureException(err);
    console.error("[ai-cost] failed to record cost:", err);
  }
}
