import type { CarouselBucket } from "./bucketing";
import type { CarouselSection } from "./types";

/** Plancher : nombre minimum de carrousels-catégories visés (Groupe B). */
export const CATEGORY_FLOOR = 4;
/** Tier 1 : catégories assez riches pour être affichées d'office. */
export const TIER1_MIN_RECIPES = 3;
/** Le client ne reçoit que la tranche utile de chaque carrousel. */
export const MAX_RECIPES_PER_CAROUSEL = 10;

function toSection({ def, recipes }: CarouselBucket): CarouselSection {
  return {
    key: def.key,
    title: def.title,
    pinned: def.pinned ?? false,
    reorderable: def.reorderable,
    recipes: recipes.slice(0, MAX_RECIPES_PER_CAROUSEL),
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Décide l'ENSEMBLE des carrousels envoyés au client (l'ordre d'affichage,
 * lui, est décidé côté client) :
 * - Groupe A (tris) : retenus dès qu'ils sont non vides.
 * - Groupe B (catégories) : toutes les tier 1 (≥ 3 recettes) ; si < 4, on
 *   complète au hasard avec des tier 2 (1-2 recettes) jusqu'à 4 — ou moins si
 *   le foyer est trop petit.
 * Chaque carrousel est cappé à 10 recettes.
 */
export function selectSections(
  buckets: CarouselBucket[],
  rand: () => number = Math.random,
): CarouselSection[] {
  const algorithmic = buckets.filter(
    (b) => b.def.predicate.type === "sort" && b.recipes.length > 0,
  );
  const categories = buckets.filter((b) => b.def.predicate.type !== "sort");

  const tier1 = categories.filter((b) => b.recipes.length >= TIER1_MIN_RECIPES);
  const tier2 = categories.filter(
    (b) => b.recipes.length >= 1 && b.recipes.length < TIER1_MIN_RECIPES,
  );

  const picked = new Set(tier1.map((b) => b.def.key));
  for (const extra of shuffle(tier2, rand)) {
    if (picked.size >= CATEGORY_FLOOR) break;
    picked.add(extra.def.key);
  }

  // Ordre catalogue en sortie : déterministe, le client shuffle de toute façon.
  const selectedCategories = categories.filter((b) => picked.has(b.def.key));
  return [...algorithmic, ...selectedCategories].map(toSection);
}
