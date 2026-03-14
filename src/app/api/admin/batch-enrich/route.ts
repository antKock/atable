import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { enrichRecipe } from "@/lib/enrichment";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // Protect with CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();

  // 1. Clear all photos and reset statuses
  console.log("[batch-enrich] Resetting all recipes...");

  // Delete manual uploads from storage
  const { data: recipesWithPhotos } = await supabase
    .from("recipes")
    .select("id, photo_url")
    .not("photo_url", "is", null);

  if (recipesWithPhotos && recipesWithPhotos.length > 0) {
    const storagePaths = recipesWithPhotos
      .map((r) => {
        const url = r.photo_url as string;
        const match = url.match(/recipe-photos\/(.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];

    if (storagePaths.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from("recipe-photos")
        .remove(storagePaths);
      if (deleteError) {
        console.error("[batch-enrich] Storage delete error:", deleteError);
      } else {
        console.log(`[batch-enrich] Deleted ${storagePaths.length} manual photos from storage`);
      }
    }
  }

  // Delete generated images from storage
  const { data: recipesWithGenerated } = await supabase
    .from("recipes")
    .select("id, generated_image_url")
    .not("generated_image_url", "is", null);

  if (recipesWithGenerated && recipesWithGenerated.length > 0) {
    const genPaths = recipesWithGenerated
      .map((r) => {
        const url = r.generated_image_url as string;
        const match = url.match(/recipe-photos\/(.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];

    if (genPaths.length > 0) {
      await supabase.storage.from("recipe-photos").remove(genPaths);
      console.log(`[batch-enrich] Deleted ${genPaths.length} generated images from storage`);
    }
  }

  // 2. Reset all recipes
  const { error: resetError } = await supabase
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
    .neq("id", "00000000-0000-0000-0000-000000000000"); // all recipes

  if (resetError) {
    console.error("[batch-enrich] Reset error:", resetError);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }

  // 3. Clear all recipe_tags
  await supabase.from("recipe_tags").delete().neq("recipe_id", "00000000-0000-0000-0000-000000000000");

  // 4. Get all recipe IDs
  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, title")
    .order("created_at", { ascending: true });

  if (!recipes || recipes.length === 0) {
    return NextResponse.json({ message: "No recipes found" });
  }

  console.log(`[batch-enrich] Starting enrichment for ${recipes.length} recipes...`);

  // 5. Process sequentially to avoid rate limits
  const results: { id: string; title: string; status: string }[] = [];

  for (const recipe of recipes) {
    try {
      console.log(`[batch-enrich] Processing: ${recipe.title}`);
      await enrichRecipe(recipe.id, true);
      results.push({ id: recipe.id, title: recipe.title, status: "ok" });
    } catch (error) {
      console.error(`[batch-enrich] Failed: ${recipe.title}`, error);
      results.push({ id: recipe.id, title: recipe.title, status: "error" });
    }
  }

  const succeeded = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "error").length;

  console.log(`[batch-enrich] Done: ${succeeded} ok, ${failed} failed`);

  return NextResponse.json({
    total: recipes.length,
    succeeded,
    failed,
    results,
  });
}
