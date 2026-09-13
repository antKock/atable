import { NextRequest, NextResponse, after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@/lib/supabase/server";
import { mapDbRowToRecipe } from "@/lib/supabase/mappers";
import { buildRecipeUpdateSchema } from "@/lib/schemas/recipe";
import { enrichRecipe, regenerateImage } from "@/lib/enrichment";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { getT } from "@/lib/i18n/server";
import { purgeRecipePhotos } from "@/lib/storage/photos";
import type { TablesUpdate } from "@/lib/db/types";
import { loadOwnedRecipe } from "@/lib/db/recipes";
import { parseJsonBody } from "@/lib/api/body";
import { revalidateRecipePaths } from "@/lib/api/revalidate";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withOwnerAuth(async (_request: NextRequest, { params }: RouteContext, owner) => {
  const { id } = await params;
  const supabase = createServerClient();
  // Lecture : accessible si la recette appartient à l'un des foyers de
  // l'owner (membre OU invité) — plus seulement le foyer du cookie (Lot 4).
  const loaded = await loadOwnedRecipe(supabase, id, owner, { all: true, withTags: true });
  if (loaded instanceof NextResponse) return loaded;

  return NextResponse.json(mapDbRowToRecipe(loaded.recipe));
});

export const PUT = withOwnerAuth(
  async (request: NextRequest, { params }: RouteContext, owner) => {
    const t = await getT();
    const { id } = await params;
    const parsed = await parseJsonBody(request, { schema: buildRecipeUpdateSchema(t), t });
    if (parsed instanceof NextResponse) return parsed;
    const result = parsed;

    const supabase = createServerClient();

    // Recette d'un foyer de l'owner + gardes d'écriture (membre du foyer de
    // LA recette, seed démo intouchable) : loadOwnedRecipe.
    const loaded = await loadOwnedRecipe(supabase, id, owner, {
      columns: ["title", "ingredients", "steps"],
      write: true,
    });
    if (loaded instanceof NextResponse) return loaded;
    const { recipe: existing } = loaded;

    const contentChanged =
      existing.title !== result.data.title ||
      (existing.ingredients ?? null) !== (result.data.ingredients ?? null) ||
      (existing.steps ?? null) !== (result.data.steps ?? null);

    const updatePayload: TablesUpdate<"recipes"> = {
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
          .insert(result.data.tagIds.map((tagId) => ({ recipe_id: id, tag_id: tagId })));

        // Rollback: restore previous tags if insert failed
        if (insertError) {
          if (existingTags && existingTags.length > 0) {
            await supabase
              .from("recipe_tags")
              .insert(existingTags.map((t) => ({ recipe_id: id, tag_id: t.tag_id })));
          }
          throw insertError;
        }
      }
    }

    revalidateRecipePaths();

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
  // Opt-out garde démo : garde fine assertNotDemoSeedMutation ci-dessus (seed
  // intouchable, recettes du visiteur libres).
  { allowDemoMutation: true },
);

export const DELETE = withOwnerAuth(
  async (_request: NextRequest, { params }: RouteContext, owner) => {
    const { id } = await params;
    const supabase = createServerClient();

    const loaded = await loadOwnedRecipe(supabase, id, owner, {
      columns: ["photo_url", "generated_image_url"],
      write: true,
    });
    if (loaded instanceof NextResponse) return loaded;
    const { recipe: existing } = loaded;

    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id)
      .eq("household_id", existing.household_id);

    if (error) throw error;

    // La ligne est partie : purger ses photos du bucket (photo + image
    // générée), sinon elles restent orphelines. Une purge qui échoue ne rend
    // pas la suppression en erreur — la recette n'existe plus — mais remonte
    // dans Sentry.
    try {
      await purgeRecipePhotos([existing]);
    } catch (purgeError) {
      Sentry.captureException(purgeError);
    }

    revalidateRecipePaths();

    return new NextResponse(null, { status: 204 });
  },
  // Opt-out garde démo : garde fine assertNotDemoSeedMutation ci-dessus.
  { allowDemoMutation: true },
);
