import { NextRequest, NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { mapDbRowToRecipe } from "@/lib/supabase/mappers";
import { RecipeUpdateSchema } from "@/lib/schemas/recipe";
import { enrichRecipe, regenerateImage } from "@/lib/enrichment";
import { withOwnerAuth, requireMember } from "@/lib/api/with-owner-auth";
import { householdIds } from "@/lib/auth/owner-context";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withOwnerAuth(
  async (_request: NextRequest, { params }: RouteContext, owner) => {
    const { id } = await params;
    const supabase = createServerClient();
    // Lecture : accessible si la recette appartient à l'un des foyers de
    // l'owner (membre OU invité) — plus seulement le foyer du cookie (Lot 4).
    const { data, error } = await supabase
      .from("recipes")
      .select("*, recipe_tags(tag_id, tags(id, name, category))")
      .eq("id", id)
      .in("household_id", householdIds(owner))
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    return NextResponse.json(mapDbRowToRecipe(data));
  },
);

export const PUT = withOwnerAuth(
  async (request: NextRequest, { params }: RouteContext, owner) => {
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

    // La recette doit exister dans un foyer de l'owner ; l'écriture exige d'y
    // être MEMBRE (invité = lecture seule). On lit household_id pour valider le
    // rôle sur LE foyer de la recette, pas sur memberships[0] (Lot 4).
    const { data: existing } = await supabase
      .from("recipes")
      .select("id, title, ingredients, steps, household_id")
      .eq("id", id)
      .in("household_id", householdIds(owner))
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const forbidden = requireMember(owner, existing.household_id);
    if (forbidden) return forbidden;

    const contentChanged =
      existing.title !== result.data.title ||
      (existing.ingredients ?? null) !== (result.data.ingredients ?? null) ||
      (existing.steps ?? null) !== (result.data.steps ?? null);

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
    // Conditional like the metadata fields: the photo-upload-failure fallback
    // PUT (RecipeForm) only sends title/ingredients/steps and must not wipe
    // notes. Editing notes doesn't trigger re-enrichment (not in contentChanged).
    if (result.data.notes !== undefined) updatePayload.notes = result.data.notes;
    // v3 metadata fields
    if (result.data.prepTime !== undefined) updatePayload.prep_time = result.data.prepTime;
    if (result.data.cookTime !== undefined) updatePayload.cook_time = result.data.cookTime;
    if (result.data.cost !== undefined) updatePayload.cost = result.data.cost;
    if (result.data.complexity !== undefined) updatePayload.complexity = result.data.complexity;
    if (result.data.seasons !== undefined) updatePayload.seasons = result.data.seasons;
    if (result.data.servings !== undefined) updatePayload.servings = result.data.servings;

    const { data, error } = await supabase
      .from("recipes")
      .update(updatePayload)
      .eq("id", id)
      .eq("household_id", existing.household_id)
      .select()
      .single();

    if (error) throw error;

    // Tag mutation: delete-then-insert with rollback on failure
    if (result.data.tagIds) {
      // Snapshot existing tags before deleting
      const { data: existingTags } = await supabase
        .from("recipe_tags")
        .select("tag_id")
        .eq("recipe_id", id);

      const { error: deleteError } = await supabase
        .from("recipe_tags")
        .delete()
        .eq("recipe_id", id);

      if (deleteError) throw deleteError;

      if (result.data.tagIds.length > 0) {
        const { error: insertError } = await supabase
          .from("recipe_tags")
          .insert(
            result.data.tagIds.map((tagId) => ({ recipe_id: id, tag_id: tagId })),
          );

        // Rollback: restore previous tags if insert failed
        if (insertError) {
          if (existingTags && existingTags.length > 0) {
            await supabase.from("recipe_tags").insert(
              existingTags.map((t) => ({ recipe_id: id, tag_id: t.tag_id })),
            );
          }
          throw insertError;
        }
      }
    }

    revalidatePath("/home");
    revalidatePath("/library");
    revalidatePath("/recipes/[id]", "page");

    after(async () => {
      if (result.data.regenerateImage) {
        await regenerateImage(id);
      }
      if (contentChanged) {
        await enrichRecipe(id);
      }
    });

    return NextResponse.json(mapDbRowToRecipe(data));
  },
);

export const DELETE = withOwnerAuth(
  async (_request: NextRequest, { params }: RouteContext, owner) => {
    const { id } = await params;
    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from("recipes")
      .select("id, household_id")
      .eq("id", id)
      .in("household_id", householdIds(owner))
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const forbidden = requireMember(owner, existing.household_id);
    if (forbidden) return forbidden;

    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id)
      .eq("household_id", existing.household_id);

    if (error) throw error;

    revalidatePath("/home");

    return new NextResponse(null, { status: 204 });
  },
);
