import { useMemo } from "react";
import type { RecipeListItem } from "@/types/recipe";

export function filterRecipes(
  recipes: RecipeListItem[],
  query: string
): RecipeListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return recipes;
  return recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      (r.ingredients?.toLowerCase().includes(q) ?? false) ||
      r.tags.some((tag) => tag.name.toLowerCase().includes(q))
  );
}

export function useRecipeSearch(
  recipes: RecipeListItem[],
  query: string
): RecipeListItem[] {
  return useMemo(() => filterRecipes(recipes, query), [recipes, query]);
}
