import openai from "@/lib/openai";
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

function buildSystemPrompt(predefinedTagNames: string[]): string {
  return `Tu es un assistant culinaire expert. Analyse la recette et retourne un JSON structuré.

TAGS — choisis uniquement parmi cette liste (max 10) :
${predefinedTagNames.join(", ")}

SEASONS — valeurs possibles : ${VALID_SEASONS.join(", ")}
PREP TIME — valeurs possibles : ${VALID_PREP_TIMES.join(", ")}
COOK TIME — valeurs possibles : ${VALID_COOK_TIMES.join(", ")}
COST — valeurs possibles : ${VALID_COST_LEVELS.join(", ")}
COMPLEXITY — valeurs possibles : ${VALID_COMPLEXITY_LEVELS.join(", ")}

IMAGE PROMPT — décris visuellement le plat terminé en anglais (pour DALL-E). Sois précis sur la présentation, les couleurs, l'angle de vue.

Réponds UNIQUEMENT avec le JSON structuré, sans texte supplémentaire.`;
}

// ---------- Retry helper ----------

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (attempt === maxRetries - 1) throw error;
      const status = (error as { status?: number }).status;
      const isRetryable = status === 429 || status === 500 || status === 503;
      if (!isRetryable) throw error;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error("Unreachable");
}

// ---------- Image pipeline ----------

async function generateAndUploadImage(
  recipeId: string,
  imagePrompt: string,
): Promise<string> {
  // Generate with DALL-E 3
  const imageResponse = await openai.images.generate({
    model: "dall-e-3",
    prompt: `${imagePrompt}. Flat realistic illustration, overhead angle, neutral warm background, soft natural lighting.`,
    n: 1,
    size: "1024x1024",
  });

  const tempUrl = imageResponse.data?.[0]?.url;
  if (!tempUrl) throw new Error("No image URL returned from DALL-E");

  // Download the image server-side
  const imageRes = await fetch(tempUrl);
  if (!imageRes.ok) throw new Error(`Failed to download image: ${imageRes.status}`);
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

  // Upload to Supabase Storage
  const supabase = createServerClient();
  const storagePath = `generated/${recipeId}/ai-image.webp`;

  const { error: uploadError } = await supabase.storage
    .from("recipe-photos")
    .upload(storagePath, imageBuffer, {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from("recipe-photos")
    .getPublicUrl(storagePath);

  return urlData.publicUrl;
}

// ---------- Main enrichment pipeline ----------

export async function enrichRecipe(
  recipeId: string,
  isCreate: boolean,
): Promise<void> {
  const supabase = createServerClient();

  try {
    // 1. Read recipe data
    const { data: recipe, error: fetchError } = await supabase
      .from("recipes")
      .select("title, ingredients, steps, prep_time, cook_time, cost, complexity, seasons, image_prompt")
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

    // 2. Load predefined tag names from DB (single source of truth)
    const { data: predefinedTags } = await supabase
      .from("tags")
      .select("name")
      .eq("is_predefined", true);

    const predefinedTagNames = (predefinedTags ?? []).map((t) => t.name);

    // 3. Call GPT-4o-mini with structured output
    let result: EnrichmentResponse;
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
                  imagePrompt: { type: "string" },
                },
                required: ["tags", "seasons", "prepTime", "cookTime", "cost", "complexity", "imagePrompt"],
                additionalProperties: false,
              },
            },
          },
          messages: [
            { role: "system", content: buildSystemPrompt(predefinedTagNames) },
            {
              role: "user",
              content: `Titre: ${recipe.title}\nIngrédients:\n${recipe.ingredients ?? ""}\nPréparation:\n${recipe.steps ?? ""}`,
            },
          ],
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("Empty response from GPT-4o-mini");
        return EnrichmentResponseSchema.parse(JSON.parse(content));
      });
    } catch (error) {
      console.error("[enrichment] GPT-4o-mini failed after retries:", error);
      await supabase
        .from("recipes")
        .update({ enrichment_status: "failed" })
        .eq("id", recipeId);
      return;
    }

    // 4. "Fill empty only" — only update null fields
    const updates: Record<string, unknown> = {};
    if (!recipe.prep_time && result.prepTime) updates.prep_time = result.prepTime;
    if (!recipe.cook_time && result.cookTime) updates.cook_time = result.cookTime;
    if (!recipe.cost && result.cost) updates.cost = result.cost;
    if (!recipe.complexity && result.complexity) updates.complexity = result.complexity;
    if ((!recipe.seasons || recipe.seasons.length === 0) && result.seasons.length > 0)
      updates.seasons = result.seasons;
    if (!recipe.image_prompt && result.imagePrompt)
      updates.image_prompt = result.imagePrompt;

    updates.enrichment_status = "enriched";

    await supabase.from("recipes").update(updates).eq("id", recipeId);

    // 5. Tags — only fill if no existing relational tags
    const { count } = await supabase
      .from("recipe_tags")
      .select("*", { count: "exact", head: true })
      .eq("recipe_id", recipeId);

    if (count === 0 && result.tags.length > 0) {
      // Look up tag IDs from predefined tags
      const { data: matchingTags } = await supabase
        .from("tags")
        .select("id, name")
        .eq("is_predefined", true)
        .in("name", result.tags);

      if (matchingTags && matchingTags.length > 0) {
        const junctionRows = matchingTags.map((tag) => ({
          recipe_id: recipeId,
          tag_id: tag.id,
        }));
        await supabase.from("recipe_tags").insert(junctionRows);
      }
    }

    // 6. Image generation (only on create)
    if (isCreate && result.imagePrompt) {
      try {
        const imageUrl = await withRetry(() =>
          generateAndUploadImage(recipeId, result.imagePrompt),
        );
        await supabase
          .from("recipes")
          .update({
            generated_image_url: imageUrl,
            image_status: "generated",
          })
          .eq("id", recipeId);
      } catch (error) {
        console.error("[enrichment] Image generation failed:", error);
        await supabase
          .from("recipes")
          .update({ image_status: "failed" })
          .eq("id", recipeId);
        // Image failure does NOT roll back metadata enrichment
      }
    }
  } catch (error) {
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
      .select("image_prompt")
      .eq("id", recipeId)
      .single();

    if (error || !recipe?.image_prompt) {
      console.error("[regenerateImage] No image_prompt found:", recipeId);
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

    const imageUrl = await withRetry(() =>
      generateAndUploadImage(recipeId, recipe.image_prompt),
    );

    await supabase
      .from("recipes")
      .update({
        generated_image_url: imageUrl,
        image_status: "generated",
      })
      .eq("id", recipeId);
  } catch (error) {
    console.error("[regenerateImage] Failed:", error);
    await supabase
      .from("recipes")
      .update({ image_status: "failed" })
      .eq("id", recipeId);
  }
}
