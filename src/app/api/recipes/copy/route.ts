import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { withOwnerAuth, resolveWriteHousehold } from "@/lib/api/with-owner-auth";
import { getPhotoStore, photoPathFromUrl } from "@/lib/storage/photos";
import { getT } from "@/lib/i18n/server";

// Duplicate a bucket-hosted image into a path owned by the new recipe so the
// copy is self-contained — if the original owner later deletes their recipe or
// photo, this copy keeps working. External URLs (not in our bucket) are
// referenced as-is.
async function duplicateImage(
  sourceUrl: string | null,
  newRecipeId: string,
  suffix: string
): Promise<string | null> {
  if (!sourceUrl) return null;
  const fromPath = photoPathFromUrl(sourceUrl);
  if (!fromPath) return sourceUrl; // not in our bucket — reference it directly

  const ext = fromPath.split(".").pop() || "webp";
  const toPath = `copies/${newRecipeId}/${suffix}.${ext}`;

  const photos = getPhotoStore();
  try {
    await photos.copy(fromPath, toPath);
  } catch {
    return sourceUrl; // fall back to referencing the original
  }
  return photos.publicUrl(toPath);
}

// POST /api/recipes/copy { token }
// Copies a shared recipe (resolved by its capability token) into the caller's
// household. Used both by guests right after they create/join a household and
// by members of another household adding a friend's recipe.
export const POST = withOwnerAuth(
  async (request: NextRequest, _ctx, owner) => {
    const t = await getT();
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: t.api.tokenMissing }, { status: 422 });
    }

    // Copie = écriture : foyer cible explicite (multi-foyer) ou repli mono-foyer,
    // toujours un foyer où l'owner est membre.
    const target = await resolveWriteHousehold(owner, body?.householdId);
    if (target instanceof NextResponse) return target;
    const { householdId } = target;
    const sessionId = owner.sessionId;

    const supabase = createServerClient();

    // Resolve the source recipe by capability token (no household scoping).
    const { data: source, error: sourceError } = await supabase
      .from("recipes")
      .select(
        "id, household_id, title, ingredients, steps, notes, photo_url, generated_image_url, prep_time, cook_time, cost, complexity, seasons, servings, image_prompt, recipe_tags(tag_id)"
      )
      .eq("share_token", token)
      .single();

    if (sourceError || !source) {
      return NextResponse.json({ error: t.api.recipeNotFound }, { status: 404 });
    }

    // Already in the caller's household — point them at the original, no copy.
    if (source.household_id === householdId) {
      return NextResponse.json({
        ok: true,
        recipeId: source.id,
        alreadyOwned: true,
      });
    }

    // Insert the copy. The recipe is already enriched, so skip the AI pipeline.
    const { data: created, error: insertError } = await supabase
      .from("recipes")
      .insert({
        title: source.title,
        ingredients: source.ingredients,
        steps: source.steps,
        notes: source.notes,
        prep_time: source.prep_time,
        cook_time: source.cook_time,
        cost: source.cost,
        complexity: source.complexity,
        seasons: source.seasons ?? [],
        servings: source.servings,
        image_prompt: source.image_prompt,
        household_id: householdId,
        source: "shared",
        created_by_device_id: sessionId,
        enrichment_status: "done",
        image_status: "done",
      })
      .select("id")
      .single();

    if (insertError || !created) {
      throw insertError ?? new Error("Failed to copy recipe");
    }
    const newId = created.id;

    // Duplicate images into the new recipe's own storage paths.
    const [photoUrl, generatedImageUrl] = await Promise.all([
      duplicateImage(source.photo_url, newId, "photo"),
      duplicateImage(source.generated_image_url, newId, "generated"),
    ]);

    if (photoUrl || generatedImageUrl) {
      await supabase
        .from("recipes")
        .update({ photo_url: photoUrl, generated_image_url: generatedImageUrl })
        .eq("id", newId);
    }

    // Copy tag associations.
    const tagIds = (source.recipe_tags ?? [])
      .map((rt: { tag_id: string }) => rt.tag_id)
      .filter(Boolean);
    if (tagIds.length > 0) {
      await supabase
        .from("recipe_tags")
        .insert(tagIds.map((tagId: string) => ({ recipe_id: newId, tag_id: tagId })));
    }

    revalidatePath("/home");

    return NextResponse.json({ ok: true, recipeId: newId });
  },
  // Opt-out garde démo : la copie atterrit dans le foyer du visiteur (la démo,
  // seul foyer où il est membre) comme recette non-seed, purgée par le cron.
  { allowDemoMutation: true },
);
