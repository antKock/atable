import { useMemo } from "react";
import type { RecipeListItem } from "@/types/recipe";

// Générique : préserve le type d'item passé (ex. LibraryRecipeItem, qui porte
// householdId/householdName en multi-foyer) plutôt que de le réduire à
// RecipeListItem.
export function filterRecipes<T extends RecipeListItem>(
  recipes: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return recipes;
  return recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      (r.ingredients?.toLowerCase().includes(q) ?? false) ||
      r.tags.some((tag) => tag.name.toLowerCase().includes(q))
  );
}

export function useRecipeSearch<T extends RecipeListItem>(
  recipes: T[],
  query: string
): T[] {
  return useMemo(() => filterRecipes(recipes, query), [recipes, query]);
}
