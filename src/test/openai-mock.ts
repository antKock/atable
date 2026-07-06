import type { ImportResult } from "@/lib/schemas/import";
import type { EnrichmentResponse } from "@/lib/schemas/enrichment";

// ---------------------------------------------------------------------------
// Canned OpenAI responses. The OpenAI client (`@/lib/openai`) is always
// vi.mock'd in tests — these builders produce the response shapes the code
// under test expects, so no real API call is ever made.
// ---------------------------------------------------------------------------

/** A minimal valid recipe-import result (all enum values are valid). */
export function importResult(overrides: Partial<ImportResult> = {}): ImportResult {
  return {
    title: "Tarte aux pommes",
    ingredients: "Pommes\nPâte brisée\nSucre",
    steps: "Éplucher les pommes\nGarnir la pâte\nEnfourner 30 min",
    prepTime: "20-30 min",
    cookTime: "30 min - 1h",
    cost: "€",
    complexity: "facile",
    seasons: ["automne"],
    servings: 4,
    ...overrides,
  };
}

/** A minimal valid enrichment result (all fields required & valid). */
export function enrichmentResult(
  overrides: Partial<EnrichmentResponse> = {},
): EnrichmentResponse {
  return {
    tags: ["Dessert", "Végétarien"],
    seasons: ["automne"],
    prepTime: "20-30 min",
    cookTime: "30 min - 1h",
    cost: "€",
    complexity: "facile",
    servings: 4,
    imagePrompt: "An apple pie on a wooden table, overhead view",
    ...overrides,
  };
}

/** Wrap a value as an OpenAI `chat.completions.create` response. */
export function chatCompletion(content: unknown) {
  return {
    choices: [
      {
        message: {
          content:
            typeof content === "string" ? content : JSON.stringify(content),
        },
      },
    ],
  };
}

/** A fake `images.generate` response carrying base64 data. */
export function imageResponse(b64 = "ZmFrZS1pbWFnZS1ieXRlcw==") {
  return { data: [{ b64_json: b64 }] };
}

/** An error shaped like an OpenAI SDK error with an HTTP status. */
export function openAIError(status: number, message = "OpenAI error") {
  return Object.assign(new Error(message), { status });
}
