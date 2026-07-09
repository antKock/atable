import { describe, it, expect } from "vitest";
import { fetchCarouselSections } from "./carousels";

// The whole fetch is ONE query: from("recipes").select().eq().order() → rows.
function mockSupabase(rows: unknown[], onQuery?: () => void) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => {
      onQuery?.();
      return { data: rows, error: null };
    },
  };
  return { from: () => builder };
}

let idCounter = 0;
function mockRecipeRow(overrides: Record<string, unknown> = {}) {
  idCounter += 1;
  return {
    id: `recipe-${idCounter}`,
    title: "Test Recipe",
    photo_url: null,
    created_at: "2026-01-01T10:00:00.000Z",
    generated_image_url: null,
    enrichment_status: "done",
    image_status: "none",
    prep_time: "10-20 min",
    cook_time: "15-30 min",
    cost: "€€",
    last_activity_at: "2026-01-01T10:00:00.000Z",
    view_count: 0,
    recipe_tags: [],
    ...overrides,
  };
}

function taggedWith(...names: string[]) {
  return names.map((name, i) => ({
    tag_id: `t-${name}-${i}`,
    tags: { id: `t-${name}-${i}`, name, category: null },
  }));
}

describe("fetchCarouselSections", () => {
  it("returns empty array when no recipes exist", async () => {
    const supabase = mockSupabase([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = await fetchCarouselSections(supabase as any, "hh-1");
    expect(sections).toEqual([]);
  });

  it("executes a single query", async () => {
    let queryCount = 0;
    const supabase = mockSupabase([mockRecipeRow()], () => queryCount++);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchCarouselSections(supabase as any, "hh-1");
    expect(queryCount).toBe(1);
  });

  it("always includes a pinned Récentes section when the household has recipes", async () => {
    const supabase = mockSupabase([mockRecipeRow()]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = await fetchCarouselSections(supabase as any, "hh-1");
    const recentes = sections.find((s) => s.key === "recentes");
    expect(recentes).toBeDefined();
    expect(recentes?.pinned).toBe(true);
    expect(recentes?.title).toBe("Récentes");
  });

  it("buckets recipes into eligible category sections (tier 1 = 3+ recipes)", async () => {
    const rows = [
      mockRecipeRow({ recipe_tags: taggedWith("Dessert") }),
      mockRecipeRow({ recipe_tags: taggedWith("Dessert") }),
      mockRecipeRow({ recipe_tags: taggedWith("Dessert", "Rapide") }),
      mockRecipeRow({ recipe_tags: taggedWith("Soupe") }),
      mockRecipeRow({ recipe_tags: taggedWith("Soupe") }),
      mockRecipeRow({ recipe_tags: taggedWith("Soupe") }),
    ];
    const supabase = mockSupabase(rows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = await fetchCarouselSections(supabase as any, "hh-1");
    const keys = sections.map((s) => s.key);
    expect(keys).toContain("desserts");
    expect(keys).toContain("soupes");
    const desserts = sections.find((s) => s.key === "desserts");
    expect(desserts?.recipes.length).toBe(3);
    expect(desserts?.reorderable).toBe(true);
  });

  it("excludes never-opened recipes from Les plus vues", async () => {
    const rows = [
      mockRecipeRow({ view_count: 0 }),
      mockRecipeRow({ view_count: 3 }),
    ];
    const supabase = mockSupabase(rows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = await fetchCarouselSections(supabase as any, "hh-1");
    const plusVues = sections.find((s) => s.key === "plusVues");
    expect(plusVues?.recipes.length).toBe(1);
  });

  it("caps each carousel to 10 recipes", async () => {
    const rows = Array.from({ length: 15 }, () => mockRecipeRow());
    const supabase = mockSupabase(rows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = await fetchCarouselSections(supabase as any, "hh-1");
    for (const s of sections) {
      expect(s.recipes.length).toBeLessThanOrEqual(10);
    }
  });

  it("maps rows to CarouselRecipeItem, without ingredients in the payload", async () => {
    const row = mockRecipeRow({
      id: "r-42",
      title: "Tarte aux pommes",
      photo_url: "https://example.com/photo.jpg",
      prep_time: "20-30 min",
      cook_time: "30-60 min",
      cost: "€€",
      recipe_tags: taggedWith("Dessert"),
    });
    const supabase = mockSupabase([row]);
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
    expect("ingredients" in recipe).toBe(false);
  });
});
