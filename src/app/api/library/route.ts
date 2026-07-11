import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { mapDbRowToRecipeListItem } from "@/lib/supabase/mappers";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { householdIds } from "@/lib/auth/owner-context";
import type { LibraryRecipeItem, Tag } from "@/types/recipe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToLibraryItem(row: Record<string, any>): LibraryRecipeItem {
  return {
    ...mapDbRowToRecipeListItem(row),
    prepTime: row.prep_time ?? null,
    cookTime: row.cook_time ?? null,
    cost: row.cost ?? null,
    seasons: row.seasons ?? [],
    // Multi-foyer (Lot 4) : chaque recette porte son foyer d'origine — le label
    // discret sous le titre (biblio, >1 foyer) et le filtre « Foyer » s'appuient
    // dessus. `households(name)` = jointure FK PostgREST.
    householdId: row.household_id,
    householdName: row.households?.name ?? null,
  };
}

// Bibliothèque fusionnée : union des foyers de l'owner (membre ET invité — un
// invité consulte en lecture). Le foyer n'est plus le `hid` du cookie mais
// l'ensemble des memberships résolus en DB (chantier foyer, Lot 4).
export const GET = withOwnerAuth(async (_request, _ctx, owner) => {
  const supabase = createServerClient();
  const ids = householdIds(owner);

  const [recipesResult, tagsResult, householdsResult] = await Promise.all([
    supabase
      .from("recipes")
      .select(
        "id, title, ingredients, photo_url, created_at, generated_image_url, enrichment_status, image_status, prep_time, cook_time, cost, seasons, household_id, households(name), recipe_tags(tag_id, tags(id, name, category))",
      )
      .in("household_id", ids)
      .order("created_at", { ascending: false }),
    // Tags globaux (household_id NULL) + tags custom de l'un des foyers de l'owner.
    supabase
      .from("tags")
      .select("id, name, category, household_id")
      .or(`household_id.is.null,household_id.in.(${ids.join(",")})`)
      .order("name"),
    supabase.from("households").select("id, name").in("id", ids),
  ]);

  if (recipesResult.error) throw recipesResult.error;
  if (tagsResult.error) throw tagsResult.error;
  if (householdsResult.error) throw householdsResult.error;

  const recipes: LibraryRecipeItem[] = (recipesResult.data ?? []).map(mapToLibraryItem);
  // Dédoublonnage par id : un tag global et un tag custom homonyme ne doivent
  // pas coexister (rare, mais la pill de filtre les afficherait en double).
  const tags: Tag[] = (tagsResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
  }));

  // Foyers de l'owner, ordonnés comme ses memberships (le hub fait foi), pour
  // la pill « Foyer » multi-select (n'apparaît que si >1 foyer).
  const byId = new Map((householdsResult.data ?? []).map((h) => [h.id, h.name]));
  const households = ids
    .filter((id) => byId.has(id))
    .map((id) => ({ id, name: byId.get(id) as string }));

  return NextResponse.json({ recipes, tags, households });
});
