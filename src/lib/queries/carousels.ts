import type { SupabaseClient } from "@supabase/supabase-js";
import { CAROUSEL_CATALOG } from "@/lib/carousels/catalog";
import { bucket } from "@/lib/carousels/bucketing";
import { selectSections } from "@/lib/carousels/selection";
import type { CarouselRecipeItem, CarouselSection } from "@/lib/carousels/types";
import type { Tag } from "@/types/recipe";

export type { CarouselRecipeItem, CarouselSection };

// Pas d'`ingredients` : la carte de carrousel ne lit que image / titre /
// temps · coût. Les tags servent au bucketing serveur.
const CAROUSEL_SELECT =
  "id, title, photo_url, created_at, generated_image_url, enrichment_status, image_status, prep_time, cook_time, cost, last_activity_at, view_count, recipe_tags(tag_id, tags(id, name, category))";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTags(row: Record<string, any>): Tag[] {
  const relationalTags = row.recipe_tags;
  if (!Array.isArray(relationalTags)) return [];
  return relationalTags
    .map(
      (
        rt: {
          tags: { id: string; name: string; category: string | null };
        } | null,
      ) =>
        rt?.tags
          ? { id: rt.tags.id, name: rt.tags.name, category: rt.tags.category }
          : null,
    )
    .filter(Boolean) as Tag[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: Record<string, any>): CarouselRecipeItem {
  return {
    id: row.id,
    title: row.title,
    tags: mapTags(row),
    photoUrl: row.photo_url ?? null,
    createdAt: row.created_at,
    generatedImageUrl: row.generated_image_url ?? null,
    enrichmentStatus: row.enrichment_status ?? "none",
    imageStatus: row.image_status ?? "none",
    prepTime: row.prep_time ?? null,
    cookTime: row.cook_time ?? null,
    cost: row.cost ?? null,
    // NOT NULL depuis la migration 024 ; le fallback reproduit son backfill.
    lastActivityAt: row.last_activity_at ?? row.created_at,
    viewCount: row.view_count ?? 0,
  };
}

/**
 * Unique porte d'entrée serveur : UNE requête (toutes les recettes du foyer +
 * tags, le serveur et la base sont colocalisés) puis catalogue → bucketing →
 * sélection (tiers + plancher, cap 10). Le client ne reçoit que la tranche
 * cappée et décide lui-même l'ordre d'affichage.
 */
export async function fetchCarouselSections(
  supabase: SupabaseClient,
  householdId: string,
): Promise<CarouselSection[]> {
  const { data } = await supabase
    .from("recipes")
    .select(CAROUSEL_SELECT)
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  const recipes = (data ?? []).map(mapRow);
  return selectSections(bucket(recipes, CAROUSEL_CATALOG));
}
