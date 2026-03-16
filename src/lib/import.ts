import openai from "@/lib/openai";
import { withRetry } from "@/lib/retry";
import { ImportResultSchema } from "@/lib/schemas/import";
import type { ImportResult } from "@/lib/schemas/import";
import {
  VALID_SEASONS,
  VALID_PREP_TIMES,
  VALID_COOK_TIMES,
  VALID_COST_LEVELS,
  VALID_COMPLEXITY_LEVELS,
} from "@/lib/schemas/enrichment";
import type { RecipeFormData } from "@/types/recipe";

export type ImportedRecipeData = Omit<RecipeFormData, "tags" | "photoUrl">;

export class ImportError extends Error {
  constructor(
    message: string,
    public readonly code: "SITE_BLOCKED" | "SITE_UNREACHABLE" | "EXTRACTION_FAILED",
  ) {
    super(message);
    this.name = "ImportError";
  }
}

// ---------- System prompt ----------

const EXTRACTION_SYSTEM_PROMPT = `Tu es un assistant culinaire expert. Extrais les données de la recette et retourne un JSON structuré en français.

Champs à extraire :
- title (string, obligatoire) : le nom de la recette
- ingredients (string | null) : liste des ingrédients, un par ligne
- steps (string | null) : étapes de préparation, une par ligne
- prepTime (string | null) : temps de préparation — valeurs possibles : ${VALID_PREP_TIMES.join(", ")}
- cookTime (string | null) : temps de cuisson — valeurs possibles : ${VALID_COOK_TIMES.join(", ")}
- cost (string | null) : coût estimé — valeurs possibles : ${VALID_COST_LEVELS.join(", ")}
- complexity (string | null) : difficulté — valeurs possibles : ${VALID_COMPLEXITY_LEVELS.join(", ")}
- seasons (string[]) : saisons appropriées — valeurs possibles : ${VALID_SEASONS.join(", ")}

Réponds UNIQUEMENT avec le JSON structuré, sans texte supplémentaire. Si un champ n'est pas trouvé, utilise null (ou [] pour seasons).`;

// ---------- JSON schema for structured output ----------

const IMPORT_JSON_SCHEMA = {
  name: "recipe_import",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      ingredients: { type: ["string", "null"] },
      steps: { type: ["string", "null"] },
      prepTime: { type: ["string", "null"], enum: [...VALID_PREP_TIMES, null] },
      cookTime: { type: ["string", "null"], enum: [...VALID_COOK_TIMES, null] },
      cost: { type: ["string", "null"], enum: [...VALID_COST_LEVELS, null] },
      complexity: {
        type: ["string", "null"],
        enum: [...VALID_COMPLEXITY_LEVELS, null],
      },
      seasons: {
        type: "array",
        items: { type: "string", enum: [...VALID_SEASONS] },
      },
    },
    required: [
      "title",
      "ingredients",
      "steps",
      "prepTime",
      "cookTime",
      "cost",
      "complexity",
      "seasons",
    ],
    additionalProperties: false,
  },
} as const;

// ---------- Map result to RecipeFormData ----------

function toFormData(result: ImportResult): Omit<RecipeFormData, "tags" | "photoUrl"> {
  return {
    title: result.title,
    ingredients: result.ingredients ?? "",
    steps: result.steps ?? "",
    prepTime: result.prepTime ?? undefined,
    cookTime: result.cookTime ?? undefined,
    cost: result.cost ?? undefined,
    complexity: result.complexity ?? undefined,
    seasons: result.seasons,
  };
}

// ---------- Screenshot OCR ----------

export async function extractRecipeFromImages(
  base64Images: string[],
): Promise<ImportedRecipeData> {
  return withRetry(async () => {
    const imageContent = base64Images.map((img) => ({
      type: "image_url" as const,
      image_url: {
        url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`,
      },
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: {
        type: "json_schema",
        json_schema: IMPORT_JSON_SCHEMA,
      },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extrais la recette de cette/ces image(s) :",
            },
            ...imageContent,
          ],
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");
    const parsed = ImportResultSchema.parse(JSON.parse(content));
    return toFormData(parsed);
  });
}

// ---------- URL scraping ----------

export async function extractRecipeFromUrl(
  url: string,
): Promise<ImportedRecipeData> {
  // Fetch HTML server-side
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ImportError("Site unreachable", "SITE_UNREACHABLE");
  }

  if (res.status === 403 || res.status === 429) {
    throw new ImportError("Site blocked bot access", "SITE_BLOCKED");
  }

  if (!res.ok) {
    throw new ImportError(`Failed to fetch URL: ${res.status}`, "SITE_UNREACHABLE");
  }

  const html = await res.text();

  // Strip non-content tags via regex
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50000); // ~12k tokens — generous enough for any recipe page

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: IMPORT_JSON_SCHEMA,
      },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extrais la recette depuis ce contenu de page web :\n\n${cleaned}`,
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");
    const parsed = ImportResultSchema.parse(JSON.parse(content));
    return toFormData(parsed);
  });
}
