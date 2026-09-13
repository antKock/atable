import type { Recipe, RecipeListItem, Tag } from "@/types/recipe";
import type { Tables } from "@/lib/db/types";

// Jointure `recipe_tags(tag_id, tags(id, name, category))` telle que
// PostgREST la renvoie (tableau, objet `tags` nullable par FK).
export type TagJoin = {
  recipe_tags?: ({ tags: Pick<Tables<"tags">, "id" | "name" | "category"> | null } | null)[] | null;
};

/** Ligne complète (`select("*")`) + jointure tags facultative. */
export type RecipeRow = Tables<"recipes"> & TagJoin;

/** Projection liste (Home/Bibliothèque/GET /api/recipes) + jointure tags. */
export type RecipeListRow = Pick<
  Tables<"recipes">,
  | "id"
  | "title"
  | "ingredients"
  | "photo_url"
  | "created_at"
  | "generated_image_url"
  | "enrichment_status"
  | "image_status"
> &
  TagJoin;

// Flatten nested recipe_tags join into tags array (partagé avec queries/carousels).
export function mapTags(row: TagJoin): Tag[] {
  const relationalTags = row.recipe_tags;
  if (!Array.isArray(relationalTags)) return [];
  return relationalTags.flatMap((rt) =>
    rt?.tags ? [{ id: rt.tags.id, name: rt.tags.name, category: rt.tags.category }] : [],
  );
}

export function mapDbRowToRecipe(row: RecipeRow): Recipe {
  const tags = mapTags(row);

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    ingredients: row.ingredients,
    steps: row.steps,
    notes: row.notes ?? null,
    tags,
    photoUrl: row.photo_url,
    // `created_at` / `updated_at` ont un DEFAULT now() sans NOT NULL : jamais
    // null en pratique, le repli ne sert qu'au typage.
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? row.created_at ?? "",
    // v3 fields
    prepTime: row.prep_time ?? null,
    cookTime: row.cook_time ?? null,
    cost: row.cost ?? null,
    complexity: row.complexity ?? null,
    seasons: row.seasons ?? [],
    servings: row.servings ?? null,
    imagePrompt: row.image_prompt ?? null,
    generatedImageUrl: row.generated_image_url ?? null,
    enrichmentStatus: row.enrichment_status ?? "none",
    imageStatus: row.image_status ?? "none",
    lastActivityAt: row.last_activity_at ?? row.created_at,
    viewCount: row.view_count ?? 0,
  };
}

export function mapDbRowToRecipeListItem(row: RecipeListRow): RecipeListItem {
  return {
    id: row.id,
    title: row.title,
    ingredients: row.ingredients,
    tags: mapTags(row),
    photoUrl: row.photo_url,
    createdAt: row.created_at ?? "",
    generatedImageUrl: row.generated_image_url ?? null,
    enrichmentStatus: row.enrichment_status ?? "none",
    imageStatus: row.image_status ?? "none",
  };
}
