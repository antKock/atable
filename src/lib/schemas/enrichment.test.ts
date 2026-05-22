import { describe, it, expect } from "vitest";
import {
  EnrichmentResponseSchema,
  VALID_SEASONS,
  VALID_PREP_TIMES,
  VALID_COOK_TIMES,
  VALID_COST_LEVELS,
  VALID_COMPLEXITY_LEVELS,
} from "./enrichment";

const valid = {
  tags: ["Dessert", "Végétarien"],
  seasons: ["automne"],
  prepTime: "20-30 min",
  cookTime: "30 min - 1h",
  cost: "€",
  complexity: "facile",
  imagePrompt: "An apple pie",
};

describe("EnrichmentResponseSchema", () => {
  it("accepts a full valid response", () => {
    expect(EnrichmentResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an empty tags array", () => {
    expect(EnrichmentResponseSchema.safeParse({ ...valid, tags: [] }).success).toBe(
      true,
    );
  });

  it("rejects more than 10 tags", () => {
    const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    expect(EnrichmentResponseSchema.safeParse({ ...valid, tags }).success).toBe(false);
  });

  it("rejects an invalid season", () => {
    expect(
      EnrichmentResponseSchema.safeParse({ ...valid, seasons: ["spring"] }).success,
    ).toBe(false);
  });

  it("rejects an invalid complexity", () => {
    expect(
      EnrichmentResponseSchema.safeParse({ ...valid, complexity: "easy" }).success,
    ).toBe(false);
  });

  it("rejects a null prepTime (required, not nullable)", () => {
    expect(
      EnrichmentResponseSchema.safeParse({ ...valid, prepTime: null }).success,
    ).toBe(false);
  });

  it("rejects a missing imagePrompt", () => {
    const { imagePrompt: _omit, ...rest } = valid;
    void _omit;
    expect(EnrichmentResponseSchema.safeParse(rest).success).toBe(false);
  });
});

describe("enrichment constants", () => {
  it("VALID_SEASONS holds the four French seasons", () => {
    expect(VALID_SEASONS).toEqual(["printemps", "ete", "automne", "hiver"]);
  });

  it("VALID_COST_LEVELS holds the three euro tiers", () => {
    expect(VALID_COST_LEVELS).toEqual(["€", "€€", "€€€"]);
  });

  it("VALID_COMPLEXITY_LEVELS holds the three difficulty tiers", () => {
    expect(VALID_COMPLEXITY_LEVELS).toEqual(["facile", "moyen", "difficile"]);
  });

  it("VALID_PREP_TIMES and VALID_COOK_TIMES are non-empty", () => {
    expect(VALID_PREP_TIMES.length).toBeGreaterThan(0);
    expect(VALID_COOK_TIMES).toContain("Aucune");
  });
});
