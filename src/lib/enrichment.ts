import openai from "@/lib/openai";
import { withRetry } from "@/lib/retry";
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

// ---------- Image pipeline ----------

async function generateAndUploadImage(
  recipeId: string,
  imagePrompt: string,
): Promise<string> {
  // Generate with gpt-image-1
  const imageResponse = await openai.images.generate({
    model: "gpt-image-1.5",
    prompt: `${imagePrompt}. Flat realistic illustration, overhead angle, neutral warm background, soft natural lighting.`,
    n: 1,
    size: "1024x1024",
    quality: "medium",
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
  const storagePath = `generated/${recipeId}/ai-image.png`;

  const { error: uploadError } = await supabase.storage
    .from("recipe-photos")
    .upload(storagePath, imageBuffer, {
      contentType: "image/png",
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
      .select("title, ingredients, steps, prep_time, cook_time, cost, complexity, seasons, image_prompt, photo_url, generated_image_url, enrichment_status")
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
      recipe.image_prompt;
    const hasImage = !!(recipe.photo_url || recipe.generated_image_url);

    // Check if tags already exist
    const { count: tagCount } = await supabase
      .from("recipe_tags")
      .select("*", { count: "exact", head: true })
      .eq("recipe_id", recipeId);

    const needsMetadata = !hasAllMetadata || tagCount === 0;
    const needsImage = !hasImage;

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

    // 3. Load predefined tag names from DB (single source of truth)
    const { data: predefinedTags } = await supabase
      .from("tags")
      .select("name")
      .eq("is_predefined", true);

    const predefinedTagNames = (predefinedTags ?? []).map((t) => t.name);

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

      // 5. "Fill empty only" — only update null fields
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

      // 6. Tags — only fill if no existing relational tags
      if (tagCount === 0 && result.tags.length > 0) {
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
    }

    // 7. Image generation (only if recipe has no photo at all)
    const imagePrompt = result?.imagePrompt || recipe.image_prompt;
    if (needsImage && imagePrompt) {
      console.log(`[enrichment] ${recipeId} — calling DALL-E`);
      try {
        const imageUrl = await withRetry(() =>
          generateAndUploadImage(recipeId, imagePrompt),
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
