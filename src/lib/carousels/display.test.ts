import { describe, it, expect } from "vitest";
import { orderSections, cascadeDedup, prepareForDisplay } from "./display";
import type { CarouselSection } from "./types";
import { carouselRecipeItem } from "@/test/fixtures";

function section(
  key: string,
  ids: string[],
  opts: { pinned?: boolean; reorderable?: boolean } = {},
): CarouselSection {
  return {
    key,
    title: key,
    pinned: opts.pinned ?? false,
    reorderable: opts.reorderable ?? true,
    recipes: ids.map((id) => carouselRecipeItem({ id })),
  };
}

describe("orderSections", () => {
  const sections = [
    section("a", ["r1"]),
    section("recentes", ["r2"], { pinned: true, reorderable: false }),
    section("b", ["r3"]),
    section("c", ["r4"]),
  ];

  it("puts the pinned section first", () => {
    for (const seed of [0, 1, 42, 123456]) {
      expect(orderSections(sections, seed)[0].key).toBe("recentes");
    }
  });

  it("is deterministic for a given seed", () => {
    expect(orderSections(sections, 42)).toEqual(orderSections(sections, 42));
  });

  it("shuffles the rest depending on the seed", () => {
    const orders = new Set(
      [0, 1, 2, 3, 4, 5, 6, 7].map((seed) =>
        orderSections(sections, seed)
          .map((s) => s.key)
          .join(","),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("keeps the relative order of existing sections when one appears mid-poll", () => {
    const seed = 7;
    const before = orderSections(sections, seed).map((s) => s.key);
    const after = orderSections([...sections, section("d", ["r9"])], seed).map((s) => s.key);
    expect(after.filter((k) => k !== "d")).toEqual(before);
  });
});

describe("cascadeDedup", () => {
  it("drops empty sections", () => {
    const result = cascadeDedup([section("a", ["r1"]), section("empty", [])]);
    expect(result.map((s) => s.key)).toEqual(["a"]);
  });

  it("masks a semantic section when neither of its first 2 cards is fresh", () => {
    const result = cascadeDedup([
      section("recentes", ["r1", "r2", "r3"], { pinned: true, reorderable: false }),
      section("redecouvrir", ["r1", "r2", "r9"], { reorderable: false }),
    ]);
    expect(result.map((s) => s.key)).toEqual(["recentes"]);
  });

  it("keeps a semantic section when one of its first 2 cards is fresh, without reordering", () => {
    const result = cascadeDedup([
      section("recentes", ["r1", "r2"], { pinned: true, reorderable: false }),
      section("plusVues", ["r1", "r9", "r2"], { reorderable: false }),
    ]);
    expect(result.map((s) => s.key)).toEqual(["recentes", "plusVues"]);
    expect(result[1].recipes.map((r) => r.id)).toEqual(["r1", "r9", "r2"]);
  });

  it("reorders category sections (stale pushed to the tail) instead of masking", () => {
    const result = cascadeDedup([
      section("recentes", ["r1", "r2"], { pinned: true, reorderable: false }),
      section("desserts", ["r1", "r5", "r2", "r6"]),
    ]);
    expect(result[1].recipes.map((r) => r.id)).toEqual(["r5", "r6", "r1", "r2"]);
  });

  it("never masks a category section even when all its recipes are stale", () => {
    const result = cascadeDedup([
      section("recentes", ["r1", "r2"], { pinned: true, reorderable: false }),
      section("desserts", ["r1", "r2"]),
    ]);
    expect(result.map((s) => s.key)).toEqual(["recentes", "desserts"]);
  });

  it("feeds the seen-set only from retained sections, cascading top to bottom", () => {
    const result = cascadeDedup([
      section("recentes", ["r1"], { pinned: true, reorderable: false }),
      // masquée : sa tête (r1) est déjà vue → ses recettes (r7) n'alimentent pas le Set
      section("redecouvrir", ["r1"], { reorderable: false }),
      // r7 doit donc être considérée fraîche ici
      section("desserts", ["r7", "r1"]),
    ]);
    expect(result.map((s) => s.key)).toEqual(["recentes", "desserts"]);
    expect(result[1].recipes.map((r) => r.id)).toEqual(["r7", "r1"]);
  });
});

describe("prepareForDisplay", () => {
  it("orders then dedups: pinned first, stale category tails, masked semantics", () => {
    const result = prepareForDisplay(
      [
        section("plusVues", ["r1", "r2"], { reorderable: false }),
        section("recentes", ["r1", "r2", "r3"], { pinned: true, reorderable: false }),
      ],
      42,
    );
    expect(result.map((s) => s.key)).toEqual(["recentes"]);
  });
});
