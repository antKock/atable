// ---------------------------------------------------------------------------
// Shared test fixtures — sample database rows.
// ---------------------------------------------------------------------------

/** A `recipes` row as returned by `SELECT *` from Supabase. */
export function recipeDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "recipe-1",
    user_id: null,
    household_id: "household-1",
    title: "Bœuf bourguignon",
    ingredients: "Bœuf\nVin rouge\nCarottes\nOignons",
    steps: "Faire revenir la viande\nAjouter le vin\nMijoter 3h",
    notes: null,
    photo_url: null,
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-02T10:00:00.000Z",
    prep_time: "20-30 min",
    cook_time: "> 2h",
    cost: "€€",
    complexity: "moyen",
    seasons: ["automne", "hiver"],
    servings: 4,
    image_prompt: "A beef bourguignon in a cast-iron pot",
    generated_image_url: null,
    enrichment_status: "enriched",
    image_status: "none",
    last_activity_at: "2026-01-01T10:00:00.000Z",
    view_count: 0,
    is_seed: false,
    ...overrides,
  };
}

/** A mapped carousel recipe item (post-`mapRow`), for the pure carousel module. */
export function carouselRecipeItem(
  overrides: Partial<import("@/lib/carousels/types").CarouselRecipeItem> & { id: string },
): import("@/lib/carousels/types").CarouselRecipeItem {
  return {
    title: `Recette ${overrides.id}`,
    tags: [],
    photoUrl: null,
    createdAt: "2026-01-01T10:00:00.000Z",
    generatedImageUrl: null,
    enrichmentStatus: "enriched",
    imageStatus: "none",
    prepTime: null,
    cookTime: null,
    cost: null,
    lastActivityAt: "2026-01-01T10:00:00.000Z",
    viewCount: 0,
    ...overrides,
  };
}

/** Tags-by-name shorthand for carousel tests. */
export function tagsNamed(...names: string[]) {
  return names.map((name, i) => ({ id: `tag-${name}-${i}`, name, category: null }));
}

/** A `tags` row. */
export function tagDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tag-1",
    name: "Végétarien",
    category: "Régime alimentaire",
    is_predefined: true,
    ...overrides,
  };
}
