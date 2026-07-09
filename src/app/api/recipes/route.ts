import { NextRequest, NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { RecipeCreateSchema } from "@/lib/schemas/recipe";
import { mapDbRowToRecipe, mapDbRowToRecipeListItem } from "@/lib/supabase/mappers";
import { enrichRecipe } from "@/lib/enrichment";
import { withHouseholdAuth } from "@/lib/api/with-household-auth";
import { enforceRecipeCreateQuota } from "@/lib/import-quota";

export const maxDuration = 60;

export const GET = withHouseholdAuth(async (request: NextRequest, _ctx, { householdId }) => {
  const { searchParams } = new URL(request.url);
  const tagsParam = searchParams.get("tags");
  const seasonParam = searchParams.get("season");
  const costParam = searchParams.get("cost");

  const supabase = createServerClient();

  // Use !inner join when filtering by tags to get INNER JOIN behavior
  const selectClause = tagsParam
    ? "id, title, ingredients, photo_url, created_at, generated_image_url, enrichment_status, image_status, recipe_tags!inner(tag_id, tags!inner(id, name, category))"
    : "id, title, ingredients, photo_url, created_at, generated_image_url, enrichment_status, image_status, recipe_tags(tag_id, tags(id, name, category))";

  let query = supabase
    .from("recipes")
    .select(selectClause)
    .eq("household_id", householdId);

  if (tagsParam) {
    const tagIds = tagsParam.split(",").filter(Boolean);
    if (tagIds.length > 0) {
      query = query.in("recipe_tags.tag_id", tagIds);
    }
  }

  if (seasonParam) {
    query = query.contains("seasons", [seasonParam]);
  }

  if (costParam) {
    query = query.eq("cost", costParam);
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) throw error;

  const recipes = (data ?? []).map(mapDbRowToRecipeListItem);

  return NextResponse.json(recipes);
});

export const POST = withHouseholdAuth(
  async (request: NextRequest, _ctx, { householdId, sessionId }) => {
    // Each create triggers AI enrichment (+ image generation), which the
    // import quota doesn't cover — cap it here.
    const quotaResponse = await enforceRecipeCreateQuota(householdId);
    if (quotaResponse) return quotaResponse;

    const body = await request.json();
    const result = RecipeCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 422 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("recipes")
      .insert({
        title: result.data.title,
        ingredients: result.data.ingredients ?? null,
        steps: result.data.steps ?? null,
        notes: result.data.notes ?? null,
        photo_url: result.data.photoUrl ?? null,
        // Metadata provided by the form (typed by the user or pre-filled by an
        // import) is persisted here; enrichment only fills what is still null.
        prep_time: result.data.prepTime ?? null,
        cook_time: result.data.cookTime ?? null,
        cost: result.data.cost ?? null,
        complexity: result.data.complexity ?? null,
        seasons: result.data.seasons ?? [],
        servings: result.data.servings ?? null,
        household_id: householdId,
        source: result.data.source,
        created_by_device_id: sessionId,
        enrichment_status: "pending",
        image_status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    // Insert tags into recipe_tags junction table
    if (result.data.tagIds && result.data.tagIds.length > 0) {
      await supabase.from("recipe_tags").insert(
        result.data.tagIds.map((tagId) => ({ recipe_id: data.id, tag_id: tagId })),
      );
    }

    revalidatePath("/home");
    revalidatePath("/recipes/[id]", "page");

    after(async () => {
      await enrichRecipe(data.id, { skipImage: result.data.willUploadPhoto });
    });

    return NextResponse.json(mapDbRowToRecipe(data), { status: 201 });
  },
);
