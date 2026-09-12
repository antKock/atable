import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { purgeRecipePhotos } from "@/lib/storage/photos";
import { enrichRecipe } from "@/lib/enrichment";
import { isBearerAuthorized } from "@/lib/cron-auth";
import { DEFAULT_MAX_BODY_BYTES, rejectOversizedBody } from "@/lib/body-limit";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Dedicated secret, NOT the CRON_SECRET of the crontab: this endpoint can rewrite
  // every household's recipes, so it must not share credentials with the
  // low-stakes cron. Fails closed when the env var is missing — otherwise
  // `Bearer undefined` would authenticate.
  if (!isBearerAuthorized(request.headers.get("authorization"), process.env.BATCH_ENRICH_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Pas de corps attendu : un corps annoncé au-delà du plafond est refusé
  // (Traefik ne plafonne pas en amont).
  const tooLarge = await rejectOversizedBody(request, DEFAULT_MAX_BODY_BYTES);
  if (tooLarge) return tooLarge;

  const { searchParams } = new URL(request.url);
  const reset = searchParams.get("reset") === "true";
  const limit = parseInt(searchParams.get("limit") || "1", 10);

  const supabase = createServerClient();

  // --- RESET MODE: clear everything first ---
  if (reset) {
    // Destructive across ALL households: requires an explicit opt-in env var
    // on top of the secret, so a leaked secret alone can't wipe production.
    if (process.env.ALLOW_BATCH_RESET !== "true") {
      return NextResponse.json({ error: "Reset mode disabled" }, { status: 403 });
    }
    console.log("[batch-enrich] RESET: clearing all photos, metadata, tags...");

    // Delete files from storage
    const { data: allRecipes } = await supabase
      .from("recipes")
      .select("id, photo_url, generated_image_url");

    const purged = await purgeRecipePhotos(allRecipes ?? []);
    if (purged > 0) {
      console.log(`[batch-enrich] Deleted ${purged} files from storage`);
    }

    // Reset all recipe fields
    await supabase
      .from("recipes")
      .update({
        photo_url: null,
        generated_image_url: null,
        enrichment_status: "none",
        image_status: "none",
        image_prompt: null,
        prep_time: null,
        cook_time: null,
        cost: null,
        complexity: null,
        seasons: [],
      })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    // Clear all recipe_tags
    await supabase
      .from("recipe_tags")
      .delete()
      .neq("recipe_id", "00000000-0000-0000-0000-000000000000");

    // Count remaining
    const { count } = await supabase
      .from("recipes")
      .select("*", { count: "exact", head: true })
      .eq("enrichment_status", "none");

    console.log(`[batch-enrich] Reset complete. ${count} recipes to enrich.`);
    return NextResponse.json({ action: "reset", recipesToEnrich: count });
  }

  // --- ENRICH MODE: process N recipes that still need enrichment ---
  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, title")
    .eq("enrichment_status", "none")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!recipes || recipes.length === 0) {
    return NextResponse.json({ action: "enrich", message: "All recipes enriched!", remaining: 0 });
  }

  const { count: totalRemaining } = await supabase
    .from("recipes")
    .select("*", { count: "exact", head: true })
    .eq("enrichment_status", "none");

  console.log(`[batch-enrich] Enriching ${recipes.length} of ${totalRemaining} remaining recipes...`);

  const results: { id: string; title: string; status: string }[] = [];

  for (const recipe of recipes) {
    try {
      console.log(`[batch-enrich] Processing: ${recipe.title}`);
      await enrichRecipe(recipe.id);
      results.push({ id: recipe.id, title: recipe.title, status: "ok" });
    } catch (error) {
      console.error(`[batch-enrich] Failed: ${recipe.title}`, error);
      results.push({ id: recipe.id, title: recipe.title, status: "error" });
    }
  }

  const remaining = (totalRemaining ?? 0) - recipes.length;
  console.log(`[batch-enrich] Batch done. ${remaining} recipes remaining.`);

  return NextResponse.json({
    action: "enrich",
    processed: recipes.length,
    remaining,
    results,
  });
}
