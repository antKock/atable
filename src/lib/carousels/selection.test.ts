import { describe, it, expect } from "vitest";
import type { CarouselBucket } from "./bucketing";
import type { CarouselDef } from "./catalog";
import {
  selectSections,
  CATEGORY_FLOOR,
  MAX_RECIPES_PER_CAROUSEL,
} from "./selection";
import { carouselRecipeItem } from "@/test/fixtures";

function recipes(n: number, prefix: string) {
  return Array.from({ length: n }, (_, i) => carouselRecipeItem({ id: `${prefix}-${i}` }));
}

function algoBucket(key: string, n: number, pinned = false): CarouselBucket {
  const def: CarouselDef = {
    key,
    title: key,
    pinned,
    reorderable: false,
    predicate: { type: "sort", by: "lastActivityAt", dir: "desc" },
  };
  return { def, recipes: recipes(n, key) };
}

function categoryBucket(key: string, n: number): CarouselBucket {
  const def: CarouselDef = {
    key,
    title: key,
    reorderable: true,
    predicate: { type: "tag", tag: key },
  };
  return { def, recipes: recipes(n, key) };
}

// rand déterministe : shuffle identité (Fisher-Yates avec j = i)
const identityRand = () => 0.9999999;

describe("selectSections", () => {
  it("keeps non-empty algorithmic buckets and drops empty ones", () => {
    const sections = selectSections(
      [algoBucket("recentes", 2, true), algoBucket("plusVues", 0)],
      identityRand,
    );
    expect(sections.map((s) => s.key)).toEqual(["recentes"]);
    expect(sections[0].pinned).toBe(true);
    expect(sections[0].reorderable).toBe(false);
  });

  it("shows ALL tier-1 categories (≥ 3 recipes), even beyond the floor", () => {
    const buckets = ["a", "b", "c", "d", "e", "f"].map((k) => categoryBucket(k, 3));
    const sections = selectSections(buckets, identityRand);
    expect(sections.length).toBe(6);
  });

  it("completes with tier-2 categories (1-2 recipes) up to the floor", () => {
    const buckets = [
      categoryBucket("rich1", 5),
      categoryBucket("rich2", 3),
      categoryBucket("thin1", 1),
      categoryBucket("thin2", 2),
      categoryBucket("thin3", 1),
      categoryBucket("empty", 0),
    ];
    const sections = selectSections(buckets, identityRand);
    expect(sections.length).toBe(CATEGORY_FLOOR);
    expect(sections.map((s) => s.key)).toContain("rich1");
    expect(sections.map((s) => s.key)).toContain("rich2");
    expect(sections.map((s) => s.key)).not.toContain("empty");
  });

  it("shows what exists when even tier 2 can't reach the floor (small household)", () => {
    const sections = selectSections(
      [categoryBucket("only1", 2), categoryBucket("only2", 1), categoryBucket("empty", 0)],
      identityRand,
    );
    expect(sections.map((s) => s.key).sort()).toEqual(["only1", "only2"]);
  });

  it("caps every carousel to 10 recipes", () => {
    const sections = selectSections(
      [algoBucket("recentes", 25, true), categoryBucket("big", 15)],
      identityRand,
    );
    for (const s of sections) {
      expect(s.recipes.length).toBeLessThanOrEqual(MAX_RECIPES_PER_CAROUSEL);
    }
  });
});
