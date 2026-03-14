import type { Recipe, RecipeListItem, Tag } from "@/types/recipe";

// Flatten nested recipe_tags join into tags array
// Falls back to legacy tags TEXT[] column when join is absent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTags(row: Record<string, any>): Tag[] {
  const relationalTags = row.recipe_tags;
  if (Array.isArray(relationalTags) && relationalTags.length > 0) {
    return relationalTags
      .map((rt: { tags: { id: string; name: string; category: string | null } } | null) =>
        rt?.tags ? { id: rt.tags.id, name: rt.tags.name, category: rt.tags.category } : null,
      )
      .filter(Boolean) as Tag[];
  }
  if (Array.isArray(row.tags)) {
    return row.tags.map((name: string) => ({ id: "", name, category: null }));
  }
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbRowToRecipe(row: Record<string, any>): Recipe {
  const tags = mapTags(row);

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    ingredients: row.ingredients,
    steps: row.steps,
    tags,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // v3 fields
    prepTime: row.prep_time ?? null,
    cookTime: row.cook_time ?? null,
    cost: row.cost ?? null,
    complexity: row.complexity ?? null,
    seasons: row.seasons ?? [],
    imagePrompt: row.image_prompt ?? null,
    generatedImageUrl: row.generated_image_url ?? null,
    enrichmentStatus: row.enrichment_status ?? "none",
    imageStatus: row.image_status ?? "none",
    lastViewedAt: row.last_viewed_at ?? null,
    viewCount: row.view_count ?? 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbRowToRecipeListItem(row: Record<string, any>): RecipeListItem {
  return {
    id: row.id,
    title: row.title,
    ingredients: row.ingredients,
    tags: mapTags(row),
    photoUrl: row.photo_url,
    createdAt: row.created_at,
    generatedImageUrl: row.generated_image_url ?? null,
    enrichmentStatus: row.enrichment_status ?? "none",
    imageStatus: row.image_status ?? "none",
  };
}
