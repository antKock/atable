import { describe, it, expect, vi, afterEach } from "vitest";
import { matchesFilters, getCurrentSeason, EMPTY_FILTERS } from "./filters";
import type { FilterState } from "./filters";
import type { Tag } from "@/types/recipe";

const allTags: Tag[] = [
  { id: "t1", name: "Végétarien", category: "Régime alimentaire" },
  { id: "t2", name: "Italienne", category: "Cuisine" },
  { id: "t3", name: "Rapide", category: "Caractéristiques" },
  { id: "t4", name: "Française", category: "Cuisine" },
];

const baseRecipe = {
  tags: [
    { id: "t1", name: "Végétarien", category: "Régime alimentaire" },
    { id: "t2", name: "Italienne", category: "Cuisine" },
  ],
  seasons: ["printemps", "ete"],
  prepTime: "10-20 min" as string | null,
  cookTime: "15-30 min" as string | null,
  cost: "€" as string | null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getCurrentSeason", () => {
  it("returns printemps for March-May", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15)); // March
    expect(getCurrentSeason()).toBe("printemps");
    vi.setSystemTime(new Date(2026, 4, 15)); // May
    expect(getCurrentSeason()).toBe("printemps");
    vi.useRealTimers();
  });

  it("returns ete for June-August", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15)); // June
    expect(getCurrentSeason()).toBe("ete");
    vi.useRealTimers();
  });

  it("returns automne for Sep-Nov", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15)); // October
    expect(getCurrentSeason()).toBe("automne");
    vi.useRealTimers();
  });

  it("returns hiver for Dec-Feb", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15)); // January
    expect(getCurrentSeason()).toBe("hiver");
    vi.setSystemTime(new Date(2025, 11, 15)); // December
    expect(getCurrentSeason()).toBe("hiver");
    vi.useRealTimers();
  });
});

describe("matchesFilters", () => {
  it("returns true with empty filters", () => {
    expect(matchesFilters(baseRecipe, EMPTY_FILTERS, allTags)).toBe(true);
  });

  it("filters by season", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15)); // printemps
    const filters: FilterState = { ...EMPTY_FILTERS, season: true };
    expect(matchesFilters(baseRecipe, filters, allTags)).toBe(true);

    vi.setSystemTime(new Date(2026, 9, 15)); // automne
    expect(matchesFilters(baseRecipe, filters, allTags)).toBe(false);
    vi.useRealTimers();
  });

  it("filters by tag (OR within category)", () => {
    const filters: FilterState = {
      ...EMPTY_FILTERS,
      tagIds: ["t2", "t4"], // Italienne OR Française (both Cuisine)
    };
    // Recipe has Italienne (t2) → should match
    expect(matchesFilters(baseRecipe, filters, allTags)).toBe(true);
  });

  it("filters by tags (AND across categories)", () => {
    const filters: FilterState = {
      ...EMPTY_FILTERS,
      tagIds: ["t1", "t2"], // Végétarien (Régime) AND Italienne (Cuisine)
    };
    // Recipe has both → match
    expect(matchesFilters(baseRecipe, filters, allTags)).toBe(true);

    const filters2: FilterState = {
      ...EMPTY_FILTERS,
      tagIds: ["t3"], // Rapide (Caractéristiques) — recipe doesn't have it
    };
    expect(matchesFilters(baseRecipe, filters2, allTags)).toBe(false);
  });

  it("filters by duration lt30", () => {
    const filters: FilterState = { ...EMPTY_FILTERS, duration: "lt30" };
    // 20 + 30 = 50 > 30 → no match
    expect(matchesFilters(baseRecipe, filters, allTags)).toBe(false);

    const quickRecipe = { ...baseRecipe, prepTime: "< 10 min", cookTime: "< 15 min" };
    // 10 + 15 = 25 ≤ 30 → match
    expect(matchesFilters(quickRecipe, filters, allTags)).toBe(true);
  });

  it("filters by duration 30to60", () => {
    const filters: FilterState = { ...EMPTY_FILTERS, duration: "30to60" };
    // 20 + 30 = 50, which is between 30 and 60 → match
    expect(matchesFilters(baseRecipe, filters, allTags)).toBe(true);
  });

  it("filters by duration gt60", () => {
    const filters: FilterState = { ...EMPTY_FILTERS, duration: "gt60" };
    const longRecipe = { ...baseRecipe, prepTime: "> 45 min", cookTime: "30-60 min" };
    // 60 + 60 = 120 > 60 → match
    expect(matchesFilters(longRecipe, filters, allTags)).toBe(true);
  });

  it("filters by cost", () => {
    const filters: FilterState = { ...EMPTY_FILTERS, cost: "€" };
    expect(matchesFilters(baseRecipe, filters, allTags)).toBe(true);

    const filters2: FilterState = { ...EMPTY_FILTERS, cost: "€€€" };
    expect(matchesFilters(baseRecipe, filters2, allTags)).toBe(false);
  });

  it("combines multiple filters with AND", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15)); // printemps
    const filters: FilterState = {
      season: true,
      tagIds: ["t1"], // Végétarien
      duration: "30to60",
      cost: "€",
    };
    expect(matchesFilters(baseRecipe, filters, allTags)).toBe(true);
    vi.useRealTimers();
  });
});
