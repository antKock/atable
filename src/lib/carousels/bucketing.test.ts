import { describe, it, expect } from "vitest";
import { bucket } from "./bucketing";
import type { CarouselDef } from "./catalog";
import { carouselRecipeItem, tagsNamed } from "@/test/fixtures";

const TAG_DEF: CarouselDef = {
  key: "desserts",
  title: "Desserts",
  reorderable: true,
  predicate: { type: "tag", tag: "Dessert" },
};

const TAGS_DEF: CarouselDef = {
  key: "cuisineDuMonde",
  title: "Cuisine du monde",
  reorderable: true,
  predicate: { type: "tags", anyOf: ["Italienne", "Libanaise / Orientale"] },
};

const FIELD_DEF: CarouselDef = {
  key: "pasCher",
  title: "Pas cher",
  reorderable: true,
  predicate: { type: "field", field: "cost", equals: "€" },
};

describe("bucket — catégories (Groupe B)", () => {
  it("filters by single tag, preserving input order", () => {
    const recipes = [
      carouselRecipeItem({ id: "r1", tags: tagsNamed("Dessert") }),
      carouselRecipeItem({ id: "r2", tags: tagsNamed("Soupe") }),
      carouselRecipeItem({ id: "r3", tags: tagsNamed("Dessert", "Rapide") }),
    ];
    const [b] = bucket(recipes, [TAG_DEF]);
    expect(b.recipes.map((r) => r.id)).toEqual(["r1", "r3"]);
  });

  it("matches tag bundles when at least one tag is present (exact DB names)", () => {
    const recipes = [
      carouselRecipeItem({ id: "r1", tags: tagsNamed("Libanaise / Orientale") }),
      carouselRecipeItem({ id: "r2", tags: tagsNamed("Française") }),
      carouselRecipeItem({ id: "r3", tags: tagsNamed("Italienne") }),
    ];
    const [b] = bucket(recipes, [TAGS_DEF]);
    expect(b.recipes.map((r) => r.id)).toEqual(["r1", "r3"]);
  });

  it("matches field equality (cost)", () => {
    const recipes = [
      carouselRecipeItem({ id: "r1", cost: "€" }),
      carouselRecipeItem({ id: "r2", cost: "€€" }),
      carouselRecipeItem({ id: "r3", cost: null }),
    ];
    const [b] = bucket(recipes, [FIELD_DEF]);
    expect(b.recipes.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("bucket — tris algorithmiques (Groupe A)", () => {
  const recipes = [
    carouselRecipeItem({ id: "old", lastActivityAt: "2026-01-01T00:00:00Z", viewCount: 5 }),
    carouselRecipeItem({ id: "new", lastActivityAt: "2026-03-01T00:00:00Z", viewCount: 0 }),
    carouselRecipeItem({ id: "mid", lastActivityAt: "2026-02-01T00:00:00Z", viewCount: 2 }),
  ];

  it("sorts by lastActivityAt desc (Récentes)", () => {
    const [b] = bucket(recipes, [
      {
        key: "recentes",
        title: "Récentes",
        pinned: true,
        reorderable: false,
        predicate: { type: "sort", by: "lastActivityAt", dir: "desc" },
      },
    ]);
    expect(b.recipes.map((r) => r.id)).toEqual(["new", "mid", "old"]);
  });

  it("sorts by lastActivityAt asc (Redécouvrir)", () => {
    const [b] = bucket(recipes, [
      {
        key: "redecouvrir",
        title: "Redécouvrir",
        reorderable: false,
        predicate: { type: "sort", by: "lastActivityAt", dir: "asc" },
      },
    ]);
    expect(b.recipes.map((r) => r.id)).toEqual(["old", "mid", "new"]);
  });

  it("sorts by viewCount desc and excludes never-opened recipes with onlyViewed", () => {
    const [b] = bucket(recipes, [
      {
        key: "plusVues",
        title: "Les plus vues",
        reorderable: false,
        predicate: { type: "sort", by: "viewCount", dir: "desc", onlyViewed: true },
      },
    ]);
    expect(b.recipes.map((r) => r.id)).toEqual(["old", "mid"]);
  });
});
