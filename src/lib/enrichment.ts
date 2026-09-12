import * as Sentry from "@sentry/nextjs";
import openai from "@/lib/openai";
import { AI_MODELS, withEffortFallback } from "@/lib/ai-models";
import { withRetry } from "@/lib/retry";
import { recordAiCost, textCostUsd, imageCostUsd } from "@/lib/ai-cost";
import { createServerClient } from "@/lib/supabase/server";
import { getPhotoStore } from "@/lib/storage/photos";
import { EnrichmentResponseSchema } from "@/lib/schemas/enrichment";
import type { EnrichmentResponse } from "@/lib/schemas/enrichment";
import {
  IMAGE_PROMPT_INSTRUCTION,
  buildEnrichmentSchema,
  buildSystemPrompt,
  recipeUserContent,
  sanitizeDietTags,
} from "@/lib/enrichment-prompt";

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
  const response = await withEffortFallback((effortParams) =>
    openai.chat.completions.create({
      model: AI_MODELS.text,
      ...effortParams,
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
    }),
  );

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
      model: AI_MODELS.text,
      inputTokens: response.usage?.prompt_tokens ?? null,
      outputTokens: response.usage?.completion_tokens ?? null,
      costUsd: textCostUsd(AI_MODELS.text, response.usage?.prompt_tokens, response.usage?.completion_tokens),
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
    model: AI_MODELS.image,
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
    model: AI_MODELS.image,
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

  // Upload to the photo store (S3 / Supabase Storage, cf. lib/storage/photos)
  const photos = getPhotoStore();
  const storagePath = `generated/${recipeId}/ai-image.webp`;
  await photos.upload(storagePath, imageBuffer, "image/webp");

  // The storage path is deterministic (upsert overwrites in place), so the
  // public URL is identical on every regeneration. Append a cache-busting
  // version param so the stored URL actually changes — otherwise React keeps
  // the same <Image src> and the CDN/browser serves the 30-day-cached old
  // image, making "regenerate" look like a no-op.
  return `${photos.publicUrl(storagePath)}?v=${Date.now()}`;
}

// ---------- Main enrichment pipeline ----------

/** La recette existe-t-elle encore ? (`select id`, sans erreur si absente.) */
async function recipeStillExists(
  supabase: ReturnType<typeof createServerClient>,
  recipeId: string,
): Promise<boolean> {
  const { data } = await supabase.from("recipes").select("id").eq("id", recipeId).maybeSingle();
  return Boolean(data);
}

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
    const tags = predefinedTags ?? [];
    const tagNames = tags.map((t) => t.name);

    // 4. Call the text model (only if metadata or tags are missing)
    let result: EnrichmentResponse | null = null;
    if (needsMetadata) {
      console.log(`[enrichment] ${recipeId} — calling text model ${AI_MODELS.text}`);
      try {
        result = await withRetry(async () => {
          const response = await withEffortFallback((effortParams) =>
            openai.chat.completions.create({
              model: AI_MODELS.text,
              ...effortParams,
              // Sans `enum` sur les tags : le banc du 2026-09-06
              // (scripts/bench/bench-enrichment-tags.mjs, 66 appels FR + EN)
              // ne mesure AUCUN tag perdu avec le prompt actuel, et l'enum
              // fait tomber ~0,5 tag/recette pour +10 % de coût et +0,3 s.
              // Le matching par nom ci-dessous reste le filet de sécurité.
              response_format: {
                type: "json_schema",
                json_schema: buildEnrichmentSchema(tagNames, { enumTags: false }),
              },
              messages: [
                { role: "system", content: buildSystemPrompt(tags) },
                { role: "user", content: recipeUserContent(recipe) },
              ],
            }),
          );

          const content = response.choices[0].message.content;
          if (!content) throw new Error("Empty response from text model");
          const enrichResult = EnrichmentResponseSchema.parse(JSON.parse(content));
          await recordAiCost({
            householdId: recipe.household_id,
            recipeId,
            callType: "metadata",
            model: AI_MODELS.text,
            inputTokens: response.usage?.prompt_tokens ?? null,
            outputTokens: response.usage?.completion_tokens ?? null,
            costUsd: textCostUsd(AI_MODELS.text, response.usage?.prompt_tokens, response.usage?.completion_tokens),
          });
          return enrichResult;
        });
      } catch (error) {
        Sentry.captureException(error);
        console.error("[enrichment] Text model failed after retries:", error);
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
    } else if (recipe.enrichment_status !== "enriched") {
      // Image-only path: metadata is already complete, so GPT is skipped —
      // but the status must still flip to "enriched", otherwise the recipe
      // stays "pending" forever and skews the AI-coverage KPI.
      await supabase
        .from("recipes")
        .update({ enrichment_status: "enriched" })
        .eq("id", recipeId);
    }

    // 7. Image generation (only if recipe has no photo at all)
    const imagePrompt = result?.imagePrompt || recipe.image_prompt;
    if (needsImage && imagePrompt) {
      // L'enrichissement tourne dans `after()` : l'utilisateur a pu supprimer
      // la recette entre-temps (ou le cron démo l'a purgée). Ne pas dépenser
      // ~1 ct d'image (ni orphaner un fichier Storage) pour une ligne disparue.
      if (!(await recipeStillExists(supabase, recipeId))) {
        console.log(`[enrichment] ${recipeId} — recette supprimée entre-temps, image ignorée`);
        return;
      }
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
