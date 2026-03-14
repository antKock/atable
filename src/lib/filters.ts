import type { Tag } from "@/types/recipe";

export type FilterState = {
  season: boolean;
  tagIds: string[];
  duration: string | null; // 'lt30' | '30to60' | 'gt60'
  cost: string | null; // '€' | '€€' | '€€€'
};

export const EMPTY_FILTERS: FilterState = {
  season: false,
  tagIds: [],
  duration: null,
  cost: null,
};

export function getCurrentSeason(): string {
  const month = new Date().getMonth(); // 0-indexed
  if (month >= 2 && month <= 4) return "printemps";
  if (month >= 5 && month <= 7) return "ete";
  if (month >= 8 && month <= 10) return "automne";
  return "hiver";
}

export function parseDurationMax(range: string | null): number {
  if (!range || range === "Aucune") return 0;
  const match = range.match(/(\d+)/);
  if (range.startsWith(">")) return parseInt(match?.[1] || "60") + 15;
  if (range.startsWith("<")) return parseInt(match?.[1] || "10");
  const parts = range.match(/(\d+)-(\d+)/);
  return parts ? parseInt(parts[2]) : parseInt(match?.[1] || "0");
}

function getTotalDuration(prepTime: string | null, cookTime: string | null): number {
  return parseDurationMax(prepTime) + parseDurationMax(cookTime);
}

interface FilterableRecipe {
  tags: Tag[];
  seasons?: string[];
  prepTime?: string | null;
  cookTime?: string | null;
  cost?: string | null;
}

export function matchesFilters(
  recipe: FilterableRecipe,
  filters: FilterState,
  allTags: Tag[],
): boolean {
  // Season filter
  if (filters.season) {
    const currentSeason = getCurrentSeason();
    if (!recipe.seasons?.includes(currentSeason)) return false;
  }

  // Tag filters: AND across categories, OR within category
  if (filters.tagIds.length > 0) {
    const selectedTags = allTags.filter((t) => filters.tagIds.includes(t.id));
    const byCategory = new Map<string | null, string[]>();
    for (const tag of selectedTags) {
      const cat = tag.category;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(tag.id);
    }
    const recipeTagIds = recipe.tags.map((t) => t.id);
    for (const [, categoryTagIds] of byCategory) {
      if (!categoryTagIds.some((id) => recipeTagIds.includes(id))) return false;
    }
  }

  // Duration filter
  if (filters.duration) {
    const total = getTotalDuration(
      recipe.prepTime ?? null,
      recipe.cookTime ?? null,
    );
    if (total === 0) return false;
    if (filters.duration === "lt30" && total > 30) return false;
    if (filters.duration === "30to60" && (total < 30 || total > 60))
      return false;
    if (filters.duration === "gt60" && total <= 60) return false;
  }

  // Cost filter
  if (filters.cost) {
    if (recipe.cost !== filters.cost) return false;
  }

  return true;
}

// Filter category definitions for the filter bar
export const FILTER_CATEGORIES = [
  { key: "Type de plat", dbCategory: "Type de plat" },
  { key: "Cuisine", dbCategory: "Cuisine" },
  { key: "Régime", dbCategory: "Régime alimentaire" },
] as const;

export const DURATION_OPTIONS = [
  { id: "lt30", label: "< 30 min" },
  { id: "30to60", label: "30 min - 1h" },
  { id: "gt60", label: "> 1h" },
];

export const COST_OPTIONS = [
  { id: "€", label: "€" },
  { id: "€€", label: "€€" },
  { id: "€€€", label: "€€€" },
];
