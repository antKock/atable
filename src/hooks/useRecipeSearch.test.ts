import { describe, it, expect } from "vitest";
import { filterRecipes } from "./useRecipeSearch";
import type { RecipeListItem } from "@/types/recipe";

function tag(name: string) {
  return { id: name, name, category: null };
}

const v3Defaults = {
  generatedImageUrl: null,
  enrichmentStatus: "none",
  imageStatus: "none",
};

const recipes: RecipeListItem[] = [
  {
    id: "1",
    title: "Poulet rôti",
    ingredients: "1 poulet\nThym\nAil",
    tags: [tag("viande"), tag("four")],
    photoUrl: null,
    createdAt: "2024-01-01",
    ...v3Defaults,
  },
  {
    id: "2",
    title: "Soupe de lentilles",
    ingredients: "Lentilles corail\nCarottes\nCumin",
    tags: [tag("végétarien"), tag("soupe")],
    photoUrl: null,
    createdAt: "2024-01-02",
    ...v3Defaults,
  },
  {
    id: "3",
    title: "Mousse au chocolat",
    ingredients: "Chocolat noir\nOeufs\nSucre",
    tags: [tag("dessert")],
    photoUrl: null,
    createdAt: "2024-01-03",
    ...v3Defaults,
  },
];

describe("filterRecipes", () => {
  it("returns all recipes when query is empty", () => {
    expect(filterRecipes(recipes, "")).toHaveLength(3);
  });

  it("returns all recipes when query is only whitespace", () => {
    expect(filterRecipes(recipes, "   ")).toHaveLength(3);
  });

  it("matches by title", () => {
    const results = filterRecipes(recipes, "poulet");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("1");
  });

  it("matches by ingredient", () => {
    const results = filterRecipes(recipes, "lentilles");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("2");
  });

  it("matches by tag", () => {
    const results = filterRecipes(recipes, "dessert");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("3");
  });

  it("is case-insensitive", () => {
    expect(filterRecipes(recipes, "POULET")).toHaveLength(1);
    expect(filterRecipes(recipes, "Chocolat")).toHaveLength(1);
    expect(filterRecipes(recipes, "VÉGÉTARIEN")).toHaveLength(1);
  });

  it("returns empty array when no match", () => {
    expect(filterRecipes(recipes, "xyz_no_match")).toHaveLength(0);
  });

  it("handles recipes with null ingredients", () => {
    const withNull: RecipeListItem[] = [
      { ...recipes[0], ingredients: null },
    ];
    expect(filterRecipes(withNull, "thym")).toHaveLength(0);
    expect(filterRecipes(withNull, "poulet")).toHaveLength(1);
  });
});
