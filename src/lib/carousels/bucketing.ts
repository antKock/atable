import type { CarouselDef, CarouselPredicate } from "./catalog";
import type { CarouselRecipeItem } from "./types";

export type CarouselBucket = {
  def: CarouselDef;
  recipes: CarouselRecipeItem[];
};

function matchesCategory(
  recipe: CarouselRecipeItem,
  predicate: Exclude<CarouselPredicate, { type: "sort" }>,
): boolean {
  switch (predicate.type) {
    case "tag":
      return recipe.tags.some((tag) => tag.name === predicate.tag);
    case "tags":
      return recipe.tags.some((tag) => predicate.anyOf.includes(tag.name));
    case "field":
      return recipe[predicate.field] === predicate.equals;
  }
}

function sortValue(recipe: CarouselRecipeItem, by: "lastActivityAt" | "viewCount"): number {
  return by === "viewCount" ? recipe.viewCount : new Date(recipe.lastActivityAt).getTime();
}

/**
 * Répartit les recettes du foyer dans tous les carrousels du catalogue.
 * Les carrousels « sort » (Groupe A) trient tout le catalogue ; les catégories
 * (Groupe B) filtrent en conservant l'ordre d'entrée (created_at desc côté
 * requête). Aucun cap ici — c'est la sélection qui tronque à 10.
 */
export function bucket(
  recipes: CarouselRecipeItem[],
  catalog: CarouselDef[],
): CarouselBucket[] {
  return catalog.map((def) => {
    const predicate = def.predicate;
    if (predicate.type === "sort") {
      const pool = predicate.onlyViewed ? recipes.filter((r) => r.viewCount > 0) : recipes;
      const sign = predicate.dir === "asc" ? 1 : -1;
      const sorted = [...pool].sort(
        (a, b) => sign * (sortValue(a, predicate.by) - sortValue(b, predicate.by)),
      );
      return { def, recipes: sorted };
    }
    return { def, recipes: recipes.filter((r) => matchesCategory(r, predicate)) };
  });
}
