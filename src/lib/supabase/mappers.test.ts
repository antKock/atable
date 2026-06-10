import { describe, it, expect } from "vitest";
import { mapDbRowToRecipe, mapDbRowToRecipeListItem } from "./mappers";
import { recipeDbRow } from "@/test/fixtures";

describe("mapDbRowToRecipe", () => {
  it("maps snake_case columns to camelCase fields", () => {
    const recipe = mapDbRowToRecipe(recipeDbRow());
    expect(recipe.id).toBe("recipe-1");
    expect(recipe.title).toBe("Bœuf bourguignon");
    expect(recipe.prepTime).toBe("20-30 min");
    expect(recipe.cookTime).toBe("> 2h");
    expect(recipe.generatedImageUrl).toBeNull();
    expect(recipe.enrichmentStatus).toBe("enriched");
  });

  it("applies defaults for missing optional fields", () => {
    const recipe = mapDbRowToRecipe(
      recipeDbRow({
        enrichment_status: undefined,
        image_status: undefined,
        view_count: undefined,
        seasons: undefined,
      }),
    );
    expect(recipe.enrichmentStatus).toBe("none");
    expect(recipe.imageStatus).toBe("none");
    expect(recipe.viewCount).toBe(0);
    expect(recipe.seasons).toEqual([]);
  });

  it("flattens a relational recipe_tags join", () => {
    const recipe = mapDbRowToRecipe(
      recipeDbRow({
        recipe_tags: [
          { tags: { id: "t1", name: "Italien", category: "Cuisine" } },
          { tags: { id: "t2", name: "Rapide", category: "Caractéristiques" } },
        ],
      }),
    );
    expect(recipe.tags).toEqual([
      { id: "t1", name: "Italien", category: "Cuisine" },
      { id: "t2", name: "Rapide", category: "Caractéristiques" },
    ]);
  });

  it("drops null entries in a relational join", () => {
    const recipe = mapDbRowToRecipe(
      recipeDbRow({
        recipe_tags: [
          { tags: null },
          { tags: { id: "t1", name: "Italien", category: "Cuisine" } },
        ],
      }),
    );
    expect(recipe.tags).toHaveLength(1);
    expect(recipe.tags[0].id).toBe("t1");
  });

  it("returns an empty tags array when the join is absent (legacy TEXT[] dropped in 018)", () => {
    const recipe = mapDbRowToRecipe(
      recipeDbRow({ recipe_tags: undefined, tags: undefined }),
    );
    expect(recipe.tags).toEqual([]);
  });
});

describe("mapDbRowToRecipeListItem", () => {
  it("maps the list-item subset of fields", () => {
    const item = mapDbRowToRecipeListItem(recipeDbRow());
    expect(item.id).toBe("recipe-1");
    expect(item.title).toBe("Bœuf bourguignon");
    expect(item.photoUrl).toBeNull();
    expect(item.enrichmentStatus).toBe("enriched");
    expect(item.imageStatus).toBe("none");
  });

  it("flattens tags like the full mapper", () => {
    const item = mapDbRowToRecipeListItem(
      recipeDbRow({
        recipe_tags: [{ tags: { id: "t1", name: "Italien", category: "Cuisine" } }],
      }),
    );
    expect(item.tags).toEqual([{ id: "t1", name: "Italien", category: "Cuisine" }]);
  });
});
