import type { Recipe } from "@/types/recipe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbRowToRecipe(row: Record<string, any>): Recipe {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    ingredients: row.ingredients,
    steps: row.steps,
    tags: row.tags ?? [],
    photoUrl: row.photo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
