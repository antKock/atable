import { NextRequest, NextResponse, after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { mapDbRowToRecipe } from "@/lib/supabase/mappers";
import { RecipeUpdateSchema } from "@/lib/schemas/recipe";
import { enrichRecipe, regenerateImage } from "@/lib/enrichment";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("recipes")
      .select("*, recipe_tags(tag_id, tags(id, name, category))")
      .eq("id", id)
      .eq("household_id", householdId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    return NextResponse.json(mapDbRowToRecipe(data));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = RecipeUpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 422 }
      );
    }

    const supabase = createServerClient();

    // Verify the recipe exists and belongs to this household
    const { data: existing } = await supabase
      .from("recipes")
      .select("id")
      .eq("id", id)
      .eq("household_id", householdId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {
      title: result.data.title,
      ingredients: result.data.ingredients ?? null,
      steps: result.data.steps ?? null,
      updated_at: new Date().toISOString(),
    };
    if (result.data.photoUrl !== undefined) {
      updatePayload.photo_url = result.data.photoUrl;
      // When removing photo, also clear generated image
      if (result.data.photoUrl === null) {
        updatePayload.generated_image_url = null;
        updatePayload.image_status = "none";
      }
    }
    if (result.data.regenerateImage) {
      updatePayload.image_status = "pending";
    }
    // v3 metadata fields
    if (result.data.prepTime !== undefined) updatePayload.prep_time = result.data.prepTime;
    if (result.data.cookTime !== undefined) updatePayload.cook_time = result.data.cookTime;
    if (result.data.cost !== undefined) updatePayload.cost = result.data.cost;
    if (result.data.complexity !== undefined) updatePayload.complexity = result.data.complexity;
    if (result.data.seasons !== undefined) updatePayload.seasons = result.data.seasons;

    const { data, error } = await supabase
      .from("recipes")
      .update(updatePayload)
      .eq("id", id)
      .eq("household_id", householdId)
      .select()
      .single();

    if (error) throw error;

    // Tag mutation: delete-then-insert pattern
    if (result.data.tagIds) {
      await supabase.from("recipe_tags").delete().eq("recipe_id", id);
      if (result.data.tagIds.length > 0) {
        await supabase.from("recipe_tags").insert(
          result.data.tagIds.map((tagId) => ({ recipe_id: id, tag_id: tagId })),
        );
      }
    }

    revalidatePath("/home");
    revalidatePath("/library");
    revalidatePath("/recipes/[id]", "page");

    after(async () => {
      if (result.data.regenerateImage) {
        await regenerateImage(id);
      }
      await enrichRecipe(id, false);
    });

    return NextResponse.json(mapDbRowToRecipe(data));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from("recipes")
      .select("id")
      .eq("id", id)
      .eq("household_id", householdId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id)
      .eq("household_id", householdId);

    if (error) throw error;

    revalidatePath("/home");

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
