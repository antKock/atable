import { describe, it, expect } from "vitest";
import { RecipeCreateSchema, RecipeUpdateSchema } from "./recipe";

describe("RecipeCreateSchema", () => {
  it("accepts a minimal recipe (title only)", () => {
    const result = RecipeCreateSchema.safeParse({ title: "Pâtes" });
    expect(result.success).toBe(true);
  });

  it("defaults seasons and tagIds to empty arrays", () => {
    const result = RecipeCreateSchema.parse({ title: "Pâtes" });
    expect(result.seasons).toEqual([]);
    expect(result.tagIds).toEqual([]);
  });

  it("rejects an empty title", () => {
    expect(RecipeCreateSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects a missing title", () => {
    expect(RecipeCreateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a null photoUrl", () => {
    expect(
      RecipeCreateSchema.safeParse({ title: "X", photoUrl: null }).success,
    ).toBe(true);
  });

  it("rejects a non-URL photoUrl", () => {
    expect(
      RecipeCreateSchema.safeParse({ title: "X", photoUrl: "not-a-url" }).success,
    ).toBe(false);
  });

  it("accepts a valid photoUrl", () => {
    expect(
      RecipeCreateSchema.safeParse({
        title: "X",
        photoUrl: "https://example.com/photo.jpg",
      }).success,
    ).toBe(true);
  });
});

describe("RecipeUpdateSchema", () => {
  it("accepts an update with title only", () => {
    expect(RecipeUpdateSchema.safeParse({ title: "Pâtes" }).success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(RecipeUpdateSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("accepts a boolean regenerateImage flag", () => {
    expect(
      RecipeUpdateSchema.safeParse({ title: "X", regenerateImage: true }).success,
    ).toBe(true);
  });

  it("rejects a non-boolean regenerateImage flag", () => {
    expect(
      RecipeUpdateSchema.safeParse({ title: "X", regenerateImage: "yes" }).success,
    ).toBe(false);
  });

  it("does not force seasons to a default (unlike create)", () => {
    const result = RecipeUpdateSchema.parse({ title: "X" });
    expect(result.seasons).toBeUndefined();
  });
});
