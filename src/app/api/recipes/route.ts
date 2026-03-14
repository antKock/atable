import { NextRequest, NextResponse, after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { RecipeCreateSchema } from "@/lib/schemas/recipe";
import { mapDbRowToRecipe, mapDbRowToRecipeListItem } from "@/lib/supabase/mappers";
import { enrichRecipe } from "@/lib/enrichment";

export async function GET() {
  try {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("recipes")
      .select("id, title, ingredients, tags, photo_url, created_at, generated_image_url, enrichment_status, image_status, recipe_tags(tag_id, tags(id, name, category))")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const recipes = (data ?? []).map(mapDbRowToRecipeListItem);

    return NextResponse.json(recipes);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        photo_url: result.data.photoUrl ?? null,
        household_id: householdId,
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
    revalidatePath("/recipes/[id]");

    after(async () => {
      await enrichRecipe(data.id, true);
    });

    return NextResponse.json(mapDbRowToRecipe(data), { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
