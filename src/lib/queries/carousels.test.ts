import { describe, it, expect } from "vitest";
import { fetchCarouselSections } from "./carousels";

function mockSupabase(responses: Record<string, unknown[]>) {
  function createBuilder(table: string) {
    const builder: Record<string, unknown> = {};
    const chainMethods = [
      "select",
      "eq",
      "not",
      "gt",
      "in",
      "order",
    ];

    for (const method of chainMethods) {
      builder[method] = () => builder;
    }

    builder.limit = () => {
      const data = responses[table] ?? [];
      return { data, error: null };
    };

    return builder;
  }

  return {
    from: (table: string) => createBuilder(table),
  };
}

const mockRecipeRow = (overrides: Record<string, unknown> = {}) => ({
  id: "recipe-1",
  title: "Test Recipe",
  ingredients: "flour, sugar",
  photo_url: null,
  created_at: "2026-01-01",
  generated_image_url: null,
  enrichment_status: "done",
  image_status: "none",
  prep_time: "10-20 min",
  cook_time: "15-30 min",
  cost: "€",
  recipe_tags: [],
  ...overrides,
});

describe("fetchCarouselSections", () => {
  it("returns empty array when no recipes exist", async () => {
    const supabase = mockSupabase({ recipes: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = await fetchCarouselSections(supabase as any, "hh-1");
    expect(sections).toEqual([]);
  });

  it("filters out sections with 0 results", async () => {
    const row = mockRecipeRow();
    const supabase = mockSupabase({ recipes: [row] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = await fetchCarouselSections(supabase as any, "hh-1");
    expect(sections.length).toBe(13);
    expect(sections.every((s) => s.recipes.length === 1)).toBe(true);
  });

  it("uses correct keys for all 13 sections", async () => {
    const row = mockRecipeRow();
    const supabase = mockSupabase({ recipes: [row] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = await fetchCarouselSections(supabase as any, "hh-1");
    const keys = sections.map((s) => s.key);
    expect(keys).toEqual([
      "nouvelles",
      "recentes",
      "redecouvrir",
      "rapide",
      "vegetarien",
      "comfortFood",
      "pasCher",
      "apero",
      "desserts",
      "cuisineItalienne",
      "cuisineDuMonde",
      "petitDejeuner",
      "boissons",
    ]);
  });

  it("uses French titles from i18n", async () => {
    const row = mockRecipeRow();
    const supabase = mockSupabase({ recipes: [row] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = await fetchCarouselSections(supabase as any, "hh-1");
    expect(sections[0].title).toBe("Nouvelles");
    expect(sections[1].title).toBe("Récentes");
    expect(sections[3].title).toBe("Rapide");
  });

  it("maps recipe rows to CarouselRecipeItem format with metadata", async () => {
    const row = mockRecipeRow({
      id: "r-42",
      title: "Tarte aux pommes",
      photo_url: "https://example.com/photo.jpg",
      prep_time: "20-30 min",
      cook_time: "30-60 min",
      cost: "€€",
      recipe_tags: [
        { tag_id: "t-1", tags: { id: "t-1", name: "Dessert", category: "dishType" } },
      ],
    });
    const supabase = mockSupabase({ recipes: [row] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = await fetchCarouselSections(supabase as any, "hh-1");
    const recipe = sections[0].recipes[0];
    expect(recipe.id).toBe("r-42");
    expect(recipe.title).toBe("Tarte aux pommes");
    expect(recipe.photoUrl).toBe("https://example.com/photo.jpg");
    expect(recipe.tags[0].name).toBe("Dessert");
    expect(recipe.prepTime).toBe("20-30 min");
    expect(recipe.cookTime).toBe("30-60 min");
    expect(recipe.cost).toBe("€€");
  });

  it("executes all 13 queries in parallel", async () => {
    let callCount = 0;

    const createBuilder = () => {
      const builder: Record<string, unknown> = {};
      const chainMethods = ["select", "eq", "not", "gt", "in", "order"];
      for (const method of chainMethods) {
        builder[method] = () => builder;
      }
      builder.limit = () => {
        callCount++;
        return { data: [], error: null };
      };
      return builder;
    };

    const supabase = { from: () => createBuilder() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchCarouselSections(supabase as any, "hh-1");
    expect(callCount).toBe(13);
  });
});
