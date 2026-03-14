import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { mapDbRowToRecipeListItem } from "@/lib/supabase/mappers";
import type { LibraryRecipeItem, Tag } from "@/types/recipe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToLibraryItem(row: Record<string, any>): LibraryRecipeItem {
  return {
    ...mapDbRowToRecipeListItem(row),
    prepTime: row.prep_time ?? null,
    cookTime: row.cook_time ?? null,
    cost: row.cost ?? null,
    seasons: row.seasons ?? [],
  };
}

export async function GET() {
  try {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();

    const [recipesResult, tagsResult] = await Promise.all([
      supabase
        .from("recipes")
        .select(
          "id, title, ingredients, tags, photo_url, created_at, generated_image_url, enrichment_status, image_status, prep_time, cook_time, cost, seasons, recipe_tags(tag_id, tags(id, name, category))",
        )
        .eq("household_id", householdId)
        .order("created_at", { ascending: false }),
      supabase.from("tags").select("id, name, category").order("name"),
    ]);

    if (recipesResult.error) throw recipesResult.error;
    if (tagsResult.error) throw tagsResult.error;

    const recipes: LibraryRecipeItem[] = (recipesResult.data ?? []).map(mapToLibraryItem);
    const tags: Tag[] = (tagsResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
    }));

    return NextResponse.json({ recipes, tags });
  } catch {
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 },
    );
  }
}
