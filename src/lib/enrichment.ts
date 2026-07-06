import * as Sentry from "@sentry/nextjs";
import openai from "@/lib/openai";
import { withRetry } from "@/lib/retry";
import { recordAiCost, textCostUsd, imageCostUsd } from "@/lib/ai-cost";
import { createServerClient } from "@/lib/supabase/server";
import { EnrichmentResponseSchema } from "@/lib/schemas/enrichment";
import type { EnrichmentResponse } from "@/lib/schemas/enrichment";
import {
  VALID_SEASONS,
  VALID_PREP_TIMES,
  VALID_COOK_TIMES,
  VALID_COST_LEVELS,
  VALID_COMPLEXITY_LEVELS,
} from "@/lib/schemas/enrichment";

// ---------- System prompt ----------

// Shared instruction for writing the image prompt. The "only depict listed
// ingredients" rule lives here, in the text-LLM instruction, where negation
// actually works — image models honour it poorly (naming "herbs" can even make
// them appear), so the constraint must be baked into the prompt text itself.
const IMAGE_PROMPT_INSTRUCTION = `Décris visuellement le plat terminé en anglais (pour un générateur d'images). Sois précis sur la présentation, les couleurs, l'angle de vue. Si la recette liste des ingrédients, ne représente QUE les ingrédients, garnitures et accompagnements listés — n'ajoute aucun aliment, ingrédient, herbe, feuille verte, sauce ou décoration non mentionné, et ne suggère pas de garniture "pour la présentation". EXCEPTION : si aucun ingrédient n'est listé (par exemple seulement un titre), imagine librement une version classique et appétissante du plat d'après son nom.`;

export type PredefinedTag = { name: string; description: string | null };

function buildSystemPrompt(predefinedTags: PredefinedTag[]): string {
  const tagLines = predefinedTags
    .map((t) => (t.description ? `- ${t.name} : ${t.description}` : `- ${t.name}`))
    .join("\n");
  return `Tu es un assistant culinaire expert. Analyse la recette et retourne un JSON structuré.

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
function recipeUserContent(recipe: {
  title: string;
  ingredients: string | null;
  steps: string | null;
}): string {
  return `Titre: ${recipe.title}\nIngrédients:\n${recipe.ingredients ?? ""}\nPréparation:\n${recipe.steps ?? ""}`;
}

// Generates a fresh image prompt from the recipe content. Used when
// regenerating an image so the prompt (and therefore the picture) actually
// changes instead of replaying the originally stored one.
async function generateImagePrompt(
  recipe: {
    title: string;
    ingredients: string | null;
    steps: string | null;
  },
  ctx?: { householdId: string; recipeId: string },
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "image_prompt",
        strict: true,
        schema: {
          type: "object",
          properties: { imagePrompt: { type: "string" } },
          required: ["imagePrompt"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "system",
        content: `Tu es un assistant culinaire expert. ${IMAGE_PROMPT_INSTRUCTION}\n\nRéponds UNIQUEMENT avec le JSON structuré { "imagePrompt": "..." }.`,
      },
      { role: "user", content: recipeUserContent(recipe) },
    ],
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("Empty image-prompt response");
  const parsed = JSON.parse(content) as { imagePrompt?: unknown };
  if (typeof parsed.imagePrompt !== "string" || parsed.imagePrompt.length === 0) {
    throw new Error("Invalid image-prompt response");
  }
  if (ctx) {
    await recordAiCost({
      householdId: ctx.householdId,
      recipeId: ctx.recipeId,
      callType: "image_prompt",
      model: "gpt-4o-mini",
      inputTokens: response.usage?.prompt_tokens ?? null,
      outputTokens: response.usage?.completion_tokens ?? null,
      costUsd: textCostUsd("gpt-4o-mini", response.usage?.prompt_tokens, response.usage?.completion_tokens),
    });
  }
  return parsed.imagePrompt;
}

// ---------- Image pipeline ----------

async function generateAndUploadImage(
  recipeId: string,
  imagePrompt: string,
  householdId: string,
): Promise<string> {
  const IMAGE_QUALITY = "low";
  const IMAGE_SIZE = "1024x1024";
  // Generate with gpt-image-1
  const imageResponse = await openai.images.generate({
    model: "gpt-image-1.5",
    prompt: `${imagePrompt}. Flat realistic illustration, overhead angle, neutral warm background, soft natural lighting. Show only the dish exactly as described above, plated simply and without any added garnish or decoration.`,
    n: 1,
    size: IMAGE_SIZE,
    quality: IMAGE_QUALITY,
    // Return WebP (~150-250 KB) instead of the default ~2 MB PNG — ~90% lighter
    // at the source, no post-processing. output_compression 80 ≈ quality 80.
    output_format: "webp",
    output_compression: 80,
  });

  await recordAiCost({
    householdId,
    recipeId,
    callType: "image",
    model: "gpt-image-1.5",
    inputTokens: imageResponse.usage?.input_tokens ?? null,
    outputTokens: imageResponse.usage?.output_tokens ?? null,
    costUsd: imageCostUsd(IMAGE_QUALITY, IMAGE_SIZE),
  });

  const imageData = imageResponse.data?.[0];
  if (!imageData) throw new Error("No image data returned from gpt-image-1");

  // gpt-image-1 returns base64 by default
  const tempUrl = imageData.url;
  const b64 = imageData.b64_json;

  // Get image buffer (base64 or URL download)
  let imageBuffer: Buffer;
  if (b64) {
    imageBuffer = Buffer.from(b64, "base64");
  } else if (tempUrl) {
    const imageRes = await fetch(tempUrl);
    if (!imageRes.ok) throw new Error(`Failed to download image: ${imageRes.status}`);
    imageBuffer = Buffer.from(await imageRes.arrayBuffer());
  } else {
    throw new Error("No image data (url or b64) returned");
  }

  // Upload to Supabase Storage
  const supabase = createServerClient();
  const storagePath = `generated/${recipeId}/ai-image.webp`;

  const { error: uploadError } = await supabase.storage
    .from("recipe-photos")
    .upload(storagePath, imageBuffer, {
      contentType: "image/webp",
      upsert: true,
      // Long cache: images are served directly (unoptimized), so let the CDN /
      // browser cache them and keep Supabase egress low.
      cacheControl: "2592000", // 30 days
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from("recipe-photos")
    .getPublicUrl(storagePath);

  // The storage path is deterministic (upsert overwrites in place), so the
  // public URL is identical on every regeneration. Append a cache-busting
  // version param so the stored URL actually changes — otherwise React keeps
  // the same <Image src> and the CDN/browser serves the 30-day-cached old
  // image, making "regenerate" look like a no-op.
  return `${urlData.publicUrl}?v=${Date.now()}`;
}

// ---------- Main enrichment pipeline ----------

export async function enrichRecipe(
  recipeId: string,
  options?: { skipImage?: boolean },
): Promise<void> {
  const supabase = createServerClient();

  try {
    // 1. Read recipe data
    const { data: recipe, error: fetchError } = await supabase
      .from("recipes")
      .select("title, ingredients, steps, prep_time, cook_time, cost, complexity, seasons, servings, image_prompt, photo_url, generated_image_url, enrichment_status, household_id")
      .eq("id", recipeId)
      .single();

    if (fetchError || !recipe) {
      console.error("[enrichment] Recipe not found:", recipeId, fetchError);
      await supabase
        .from("recipes")
        .update({ enrichment_status: "failed" })
        .eq("id", recipeId);
      return;
    }

    // 2. Check if enrichment is needed at all
    const hasAllMetadata =
      recipe.prep_time &&
      recipe.cook_time &&
      recipe.cost &&
      recipe.complexity &&
      recipe.seasons &&
      recipe.seasons.length > 0 &&
      recipe.servings &&
      recipe.image_prompt;
    const hasImage = !!(recipe.photo_url || recipe.generated_image_url);

    // Check if tags already exist
    const { count: tagCount } = await supabase
      .from("recipe_tags")
      .select("*", { count: "exact", head: true })
      .eq("recipe_id", recipeId);

    const needsMetadata = !hasAllMetadata || tagCount === 0;
    // skipImage: the caller knows a user photo is about to be uploaded (which
    // will set photo_url), so generating an AI image here would be wasted spend.
    // image_status is left "pending" — the photo-upload route clears it on
    // success, or the create flow falls back to generation if the upload fails.
    const needsImage = !hasImage && !options?.skipImage;

    console.log(`[enrichment] ${recipeId} — needsMetadata=${needsMetadata} needsImage=${needsImage} (tags=${tagCount})`);

    if (!needsMetadata && !needsImage) {
      console.log(`[enrichment] ${recipeId} — skipping, everything filled`);

      if (recipe.enrichment_status !== "enriched") {
        await supabase
          .from("recipes")
          .update({ enrichment_status: "enriched" })
          .eq("id", recipeId);
      }
      return;
    }

    // 3. Load predefined tags (name + definition) from DB (single source of truth)
    const { data: predefinedTags } = await supabase
      .from("tags")
      .select("name, description")
      .eq("is_predefined", true);

    // 4. Call GPT-4o-mini (only if metadata or tags are missing)
    let result: EnrichmentResponse | null = null;
    if (needsMetadata) {
      console.log(`[enrichment] ${recipeId} — calling GPT-4o-mini`);
      try {
        result = await withRetry(async () => {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "enrichment",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    tags: { type: "array", items: { type: "string" }, maxItems: 10 },
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
              },
            },
            messages: [
              { role: "system", content: buildSystemPrompt(predefinedTags ?? []) },
              { role: "user", content: recipeUserContent(recipe) },
            ],
          });

          const content = response.choices[0].message.content;
          if (!content) throw new Error("Empty response from GPT-4o-mini");
          const enrichResult = EnrichmentResponseSchema.parse(JSON.parse(content));
          await recordAiCost({
            householdId: recipe.household_id,
            recipeId,
            callType: "metadata",
            model: "gpt-4o-mini",
            inputTokens: response.usage?.prompt_tokens ?? null,
            outputTokens: response.usage?.completion_tokens ?? null,
            costUsd: textCostUsd("gpt-4o-mini", response.usage?.prompt_tokens, response.usage?.completion_tokens),
          });
          return enrichResult;
        });
      } catch (error) {
        Sentry.captureException(error);
        console.error("[enrichment] GPT-4o-mini failed after retries:", error);
        await supabase
          .from("recipes")
          .update({ enrichment_status: "failed" })
          .eq("id", recipeId);
        return;
      }

      // 5. "Fill empty only" — only update null fields
      const updates: Record<string, unknown> = {};
      if (!recipe.prep_time && result.prepTime) updates.prep_time = result.prepTime;
      if (!recipe.cook_time && result.cookTime) updates.cook_time = result.cookTime;
      if (!recipe.cost && result.cost) updates.cost = result.cost;
      if (!recipe.complexity && result.complexity) updates.complexity = result.complexity;
      if ((!recipe.seasons || recipe.seasons.length === 0) && result.seasons.length > 0)
        updates.seasons = result.seasons;
      if (!recipe.servings && result.servings) updates.servings = result.servings;
      if (!recipe.image_prompt && result.imagePrompt)
        updates.image_prompt = result.imagePrompt;

      updates.enrichment_status = "enriched";

      await supabase.from("recipes").update(updates).eq("id", recipeId);

      // 6. Tags — only fill if no existing relational tags
      const cleanTags = sanitizeDietTags(result.tags);
      if (tagCount === 0 && cleanTags.length > 0) {
        const { data: matchingTags } = await supabase
          .from("tags")
          .select("id, name")
          .eq("is_predefined", true)
          .in("name", cleanTags);

        if (matchingTags && matchingTags.length > 0) {
          const junctionRows = matchingTags.map((tag) => ({
            recipe_id: recipeId,
            tag_id: tag.id,
          }));
          await supabase.from("recipe_tags").insert(junctionRows);
        }
      }
    }

    // 7. Image generation (only if recipe has no photo at all)
    const imagePrompt = result?.imagePrompt || recipe.image_prompt;
    if (needsImage && imagePrompt) {
      console.log(`[enrichment] ${recipeId} — calling DALL-E`);
      try {
        const imageUrl = await withRetry(() =>
          generateAndUploadImage(recipeId, imagePrompt, recipe.household_id),
        );
        await supabase
          .from("recipes")
          .update({
            generated_image_url: imageUrl,
            image_status: "generated",
          })
          .eq("id", recipeId);
      } catch (error) {
        Sentry.captureException(error);
        console.error("[enrichment] Image generation failed:", error);
        await supabase
          .from("recipes")
          .update({ image_status: "failed" })
          .eq("id", recipeId);
        // Image failure does NOT roll back metadata enrichment
      }
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error("[enrichment] Unexpected error:", error);
    await supabase
      .from("recipes")
      .update({ enrichment_status: "failed" })
      .eq("id", recipeId);
  }
}

// ---------- Image-only regeneration ----------

export async function regenerateImage(recipeId: string): Promise<void> {
  const supabase = createServerClient();

  try {
    const { data: recipe, error } = await supabase
      .from("recipes")
      .select("title, ingredients, steps, image_prompt, household_id")
      .eq("id", recipeId)
      .single();

    if (error || !recipe?.title) {
      console.error("[regenerateImage] Recipe not found:", recipeId);
      await supabase
        .from("recipes")
        .update({ image_status: "failed" })
        .eq("id", recipeId);
      return;
    }

    await supabase
      .from("recipes")
      .update({ image_status: "pending" })
      .eq("id", recipeId);

    // Recompute the image prompt from the recipe content. Replaying the stored
    // prompt would reproduce the exact same picture (and any mistakes baked into
    // it, e.g. herb garnishes the LLM had added). Fall back to the stored prompt
    // if the recompute fails.
    let imagePrompt = recipe.image_prompt;
    try {
      imagePrompt = await withRetry(() =>
        generateImagePrompt(recipe, { householdId: recipe.household_id, recipeId }),
      );
      await supabase
        .from("recipes")
        .update({ image_prompt: imagePrompt })
        .eq("id", recipeId);
    } catch (err) {
      console.error("[regenerateImage] Prompt recompute failed, reusing stored prompt:", err);
    }

    if (!imagePrompt) {
      await supabase
        .from("recipes")
        .update({ image_status: "failed" })
        .eq("id", recipeId);
      return;
    }

    const imageUrl = await withRetry(() =>
      generateAndUploadImage(recipeId, imagePrompt, recipe.household_id),
    );

    await supabase
      .from("recipes")
      .update({
        generated_image_url: imageUrl,
        image_status: "generated",
      })
      .eq("id", recipeId);
  } catch (error) {
    Sentry.captureException(error);
    console.error("[regenerateImage] Failed:", error);
    await supabase
      .from("recipes")
      .update({ image_status: "failed" })
      .eq("id", recipeId);
  }
}
