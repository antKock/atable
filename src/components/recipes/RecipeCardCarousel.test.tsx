// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import RecipeCardCarousel, { formatDuration } from "./RecipeCardCarousel";
import type { CarouselRecipeItem } from "@/lib/queries/carousels";

afterEach(() => cleanup());

const baseRecipe: CarouselRecipeItem = {
  id: "r-1",
  title: "Poulet rôti",
  ingredients: null,
  tags: [],
  photoUrl: null,
  createdAt: "2024-01-01",
  generatedImageUrl: null,
  enrichmentStatus: "done",
  imageStatus: "none",
  prepTime: "10-20 min",
  cookTime: "30-60 min",
  cost: "€€",
};

describe("formatDuration", () => {
  it("returns null when both are null", () => {
    expect(formatDuration(null, null)).toBeNull();
  });

  it("returns null when both are Aucune/null", () => {
    expect(formatDuration(null, "Aucune")).toBeNull();
  });

  it("sums prep and cook max values", () => {
    expect(formatDuration("10-20 min", "15-30 min")).toBe("50 min");
  });

  it("handles < prefix", () => {
    expect(formatDuration("< 10 min", "< 15 min")).toBe("25 min");
  });

  it("handles > prefix", () => {
    expect(formatDuration("> 45 min", "> 60 min")).toBe("2h15");
  });

  it("formats hours correctly", () => {
    expect(formatDuration("30-45 min", "30-60 min")).toBe("1h45");
  });

  it("formats exact hours", () => {
    expect(formatDuration("20-30 min", "15-30 min")).toBe("1h");
  });

  it("handles single value only prep", () => {
    expect(formatDuration("10-20 min", null)).toBe("20 min");
  });

  it("handles single value only cook", () => {
    expect(formatDuration(null, "15-30 min")).toBe("30 min");
  });
});

describe("RecipeCardCarousel", () => {
  it("renders recipe title", () => {
    render(<RecipeCardCarousel recipe={baseRecipe} />);
    expect(screen.getByText("Poulet rôti")).toBeDefined();
  });

  it("renders as a link to recipe detail", () => {
    const { container } = render(<RecipeCardCarousel recipe={baseRecipe} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/recipes/r-1");
  });

  it("has aria-label with recipe title", () => {
    const { container } = render(<RecipeCardCarousel recipe={baseRecipe} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("aria-label")).toBe("Poulet rôti");
  });

  it("renders subtitle with duration and cost", () => {
    render(<RecipeCardCarousel recipe={baseRecipe} />);
    // 20 + 60 = 80 min = 1h20, cost = €€
    expect(screen.getByText("1h20 · €€")).toBeDefined();
  });

  it("renders duration only when no cost", () => {
    render(
      <RecipeCardCarousel recipe={{ ...baseRecipe, cost: null }} />,
    );
    expect(screen.getByText("1h20")).toBeDefined();
  });

  it("renders cost only when no duration", () => {
    render(
      <RecipeCardCarousel
        recipe={{ ...baseRecipe, prepTime: null, cookTime: null }}
      />,
    );
    expect(screen.getByText("€€")).toBeDefined();
  });

  it("renders placeholder when no image", () => {
    const { container } = render(<RecipeCardCarousel recipe={baseRecipe} />);
    // Should have a div with inline gradient style instead of img
    const img = container.querySelector("img");
    expect(img).toBeNull();
  });

  it("has active:scale class for press feedback", () => {
    const { container } = render(<RecipeCardCarousel recipe={baseRecipe} />);
    const link = container.querySelector("a");
    expect(link?.className).toContain("active:scale-[0.97]");
  });
});
