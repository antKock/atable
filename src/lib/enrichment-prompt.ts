import type { ResponseFormatJSONSchema } from "openai/resources/shared";
import {
  VALID_SEASONS,
  VALID_PREP_TIMES,
  VALID_COOK_TIMES,
  VALID_COST_LEVELS,
  VALID_COMPLEXITY_LEVELS,
} from "@/lib/schemas/enrichment";

// ---------------------------------------------------------------------------
// Prompt, schéma de sortie et garde-fous de l'enrichissement — module PUR
// (aucun client, aucun accès réseau/DB). Source unique partagée entre la prod
// (enrichment.ts) et le banc d'essai scripts/bench/bench-enrichment-tags.mjs,
// qui l'importe tel quel via le strip-types natif de Node : ne pas y ajouter
// d'import à effet de bord ni d'alias `@/` vers un module impur.
// ---------------------------------------------------------------------------

// Shared instruction for writing the image prompt. The "only depict listed
// ingredients" rule lives here, in the text-LLM instruction, where negation
// actually works — image models honour it poorly (naming "herbs" can even make
// them appear), so the constraint must be baked into the prompt text itself.
export const IMAGE_PROMPT_INSTRUCTION = `Décris visuellement le plat terminé en anglais (pour un générateur d'images). Sois précis sur la présentation, les couleurs, l'angle de vue. Si la recette liste des ingrédients, ne représente QUE les ingrédients, garnitures et accompagnements listés — n'ajoute aucun aliment, ingrédient, herbe, feuille verte, sauce ou décoration non mentionné, et ne suggère pas de garniture "pour la présentation". EXCEPTION : si aucun ingrédient n'est listé (par exemple seulement un titre), imagine librement une version classique et appétissante du plat d'après son nom.`;

export type PredefinedTag = { name: string; description: string | null };

export function buildSystemPrompt(predefinedTags: PredefinedTag[]): string {
  const tagLines = predefinedTags
    .map((t) => (t.description ? `- ${t.name} : ${t.description}` : `- ${t.name}`))
    .join("\n");
  return `Tu es un assistant culinaire expert. Analyse la recette et retourne un JSON structuré.

La recette peut être écrite dans n'importe quelle langue (français, anglais, portugais…) : analyse-la telle quelle. Les TAGS et les valeurs énumérées ci-dessous sont des codes en français à reprendre EXACTEMENT tels quels, même si la recette est dans une autre langue.

TAGS — choisis uniquement parmi cette liste, en respectant strictement la définition de chaque tag :
${tagLines}

Règles d'attribution des tags :
- N'assigne un tag que s'il est factuellement vrai pour cette recette, d'après sa définition et les ingrédients listés.
- Les tags de régime alimentaire (Végétarien, Végan, Sans gluten, Sans lactose) sont binaires : à poser uniquement si TOUS les ingrédients satisfont strictement la définition, jamais par défaut ni approximativement.
- La plupart des recettes ont 3 à 5 tags (maximum 10). Si trop de tags s'appliquent, garde les plus informatifs — ne sacrifie jamais un tag de régime ou de protéine, réduis d'abord parmi Occasion et Caractéristiques.

SEASONS — valeurs possibles : ${VALID_SEASONS.join(", ")}
PREP TIME — valeurs possibles : ${VALID_PREP_TIMES.join(", ")}
COOK TIME — valeurs possibles : ${VALID_COOK_TIMES.join(", ")}
COST — valeurs possibles : ${VALID_COST_LEVELS.join(", ")}
COMPLEXITY — valeurs possibles : ${VALID_COMPLEXITY_LEVELS.join(", ")}
SERVINGS — nombre de personnes pour lequel la recette est prévue (entier 1 à 20) : uniquement si la recette l'indique explicitement ou si les quantités le rendent évident ; sinon null — n'invente jamais de nombre.

IMAGE PROMPT — ${IMAGE_PROMPT_INSTRUCTION}

Réponds UNIQUEMENT avec le JSON structuré, sans texte supplémentaire.`;
}

export type EnrichmentSchemaOptions = {
  /**
   * Contraindre `tags[]` à un `enum` des noms prédéfinis (codes FR stockés en
   * base). Sans enum, le modèle peut traduire ou inventer un tag (« Chicken »),
   * que le matching par nom ignore ensuite en silence.
   */
  enumTags: boolean;
};

/**
 * Schéma `response_format.json_schema` (Structured Outputs, strict) de la
 * réponse d'enrichissement. `tagNames` = noms des tags prédéfinis chargés en
 * base ; liste vide → `tags` reste une chaîne libre (un `enum` vide est refusé
 * par l'API, et aucun tag ne pourrait matcher de toute façon).
 */
export function buildEnrichmentSchema(
  tagNames: readonly string[],
  { enumTags }: EnrichmentSchemaOptions,
): ResponseFormatJSONSchema.JSONSchema {
  const tagItem =
    enumTags && tagNames.length > 0
      ? { type: "string", enum: [...tagNames] }
      : { type: "string" };
  return {
    name: "enrichment",
    strict: true,
    schema: {
      type: "object",
      properties: {
        tags: { type: "array", items: tagItem, maxItems: 10 },
        seasons: {
          type: "array",
          items: { type: "string", enum: [...VALID_SEASONS] },
        },
        prepTime: { type: "string", enum: [...VALID_PREP_TIMES] },
        cookTime: { type: "string", enum: [...VALID_COOK_TIMES] },
        cost: { type: "string", enum: [...VALID_COST_LEVELS] },
        complexity: { type: "string", enum: [...VALID_COMPLEXITY_LEVELS] },
        servings: { type: ["integer", "null"] },
        imagePrompt: { type: "string" },
      },
      required: ["tags", "seasons", "prepTime", "cookTime", "cost", "complexity", "servings", "imagePrompt"],
      additionalProperties: false,
    },
  };
}

const MEAT_FISH_TAGS = new Set(["Poulet", "Bœuf", "Porc", "Agneau", "Poisson", "Fruits de mer"]);

// Safety net for the "Végétarien on a salmon recipe" bug: prompt definitions
// reduce it but stay probabilistic. When the LLM's own output names an animal
// protein, drop the contradictory diet tags instead of trusting it.
export function sanitizeDietTags(tags: string[]): string[] {
  const hasMeatOrFish = tags.some((t) => MEAT_FISH_TAGS.has(t));
  const hasAnimalProduct = hasMeatOrFish || tags.includes("Œufs");
  return tags.filter((t) => {
    if (t === "Végétarien") return !hasMeatOrFish;
    if (t === "Végan") return !hasAnimalProduct;
    return true;
  });
}

// Builds a recipe content block (title + ingredients + steps) for the prompt.
export function recipeUserContent(recipe: {
  title: string;
  ingredients: string | null;
  steps: string | null;
}): string {
  return `Titre: ${recipe.title}\nIngrédients:\n${recipe.ingredients ?? ""}\nPréparation:\n${recipe.steps ?? ""}`;
}
