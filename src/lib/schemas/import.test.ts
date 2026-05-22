import { describe, it, expect } from "vitest";
import {
  ImportScreenshotSchema,
  ImportUrlSchema,
  ImportResultSchema,
  MAX_VOICE_FILE_SIZE,
  VALID_VOICE_MIME_TYPES,
} from "./import";

describe("ImportScreenshotSchema", () => {
  it("accepts 1 to 5 non-empty images", () => {
    expect(ImportScreenshotSchema.safeParse({ images: ["a"] }).success).toBe(true);
    expect(
      ImportScreenshotSchema.safeParse({ images: ["a", "b", "c", "d", "e"] }).success,
    ).toBe(true);
  });

  it("rejects an empty array", () => {
    expect(ImportScreenshotSchema.safeParse({ images: [] }).success).toBe(false);
  });

  it("rejects more than 5 images", () => {
    expect(
      ImportScreenshotSchema.safeParse({
        images: ["a", "b", "c", "d", "e", "f"],
      }).success,
    ).toBe(false);
  });

  it("rejects an empty-string image", () => {
    expect(ImportScreenshotSchema.safeParse({ images: [""] }).success).toBe(false);
  });

  it("rejects an oversized image", () => {
    const huge = "x".repeat(15_000_001);
    expect(ImportScreenshotSchema.safeParse({ images: [huge] }).success).toBe(false);
  });
});

describe("ImportUrlSchema", () => {
  it("accepts an https URL", () => {
    expect(
      ImportUrlSchema.safeParse({ url: "https://marmiton.org/recette/123" }).success,
    ).toBe(true);
  });

  it("rejects an http URL", () => {
    expect(
      ImportUrlSchema.safeParse({ url: "http://marmiton.org/recette" }).success,
    ).toBe(false);
  });

  it("rejects a non-URL string", () => {
    expect(ImportUrlSchema.safeParse({ url: "not a url" }).success).toBe(false);
  });
});

describe("ImportResultSchema", () => {
  const valid = {
    title: "Tarte aux pommes",
    ingredients: "Pommes",
    steps: "Cuire",
    prepTime: "20-30 min",
    cookTime: "30 min - 1h",
    cost: "€",
    complexity: "facile",
    seasons: ["automne"],
  };

  it("accepts a full valid result", () => {
    expect(ImportResultSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts null ingredients/steps and nullable metadata", () => {
    expect(
      ImportResultSchema.safeParse({
        ...valid,
        ingredients: null,
        steps: null,
        prepTime: null,
        cookTime: null,
        cost: null,
        complexity: null,
      }).success,
    ).toBe(true);
  });

  it("rejects a missing title", () => {
    expect(
      ImportResultSchema.safeParse({
        ingredients: null,
        steps: null,
        prepTime: null,
        cookTime: null,
        cost: null,
        complexity: null,
        seasons: [],
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid season", () => {
    expect(
      ImportResultSchema.safeParse({ ...valid, seasons: ["spring"] }).success,
    ).toBe(false);
  });

  it("rejects an invalid prepTime", () => {
    expect(
      ImportResultSchema.safeParse({ ...valid, prepTime: "5 min" }).success,
    ).toBe(false);
  });
});

describe("voice import constants", () => {
  it("MAX_VOICE_FILE_SIZE is 10 MB", () => {
    expect(MAX_VOICE_FILE_SIZE).toBe(10 * 1024 * 1024);
  });

  it("VALID_VOICE_MIME_TYPES covers the expected audio formats", () => {
    expect(VALID_VOICE_MIME_TYPES).toContain("audio/webm");
    expect(VALID_VOICE_MIME_TYPES).toContain("audio/ogg");
    expect(VALID_VOICE_MIME_TYPES).toContain("audio/mp4");
    expect(VALID_VOICE_MIME_TYPES).toContain("audio/mpeg");
  });
});
