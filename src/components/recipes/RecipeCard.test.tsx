// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import RecipeCard from "./RecipeCard";
import type { RecipeListItem } from "@/types/recipe";

afterEach(() => cleanup());

const baseRecipe: RecipeListItem = {
  id: "abc-123",
  title: "Poulet rôti",
  ingredients: "1 poulet\nThym",
  tags: ["viande"],
  photoUrl: null,
  createdAt: "2024-01-01T00:00:00Z",
};

describe("RecipeCard", () => {
  it("renders a link to the recipe detail page", () => {
    render(<RecipeCard recipe={baseRecipe} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/recipes/abc-123");
  });

  it("displays the recipe title in the overlay", () => {
    render(<RecipeCard recipe={baseRecipe} />);
    // Use getAllByText since the title also appears as aria-label on the link
    const matches = screen.getAllByText("Poulet rôti");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows a warm placeholder when no photo is provided", () => {
    const { container } = render(<RecipeCard recipe={baseRecipe} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".bg-gradient-to-br")).toBeDefined();
  });

  it("renders an img element when photoUrl is provided", () => {
    const recipe = {
      ...baseRecipe,
      photoUrl:
        "https://example.supabase.co/storage/v1/object/public/recipe-photos/device/recipe/photo.webp",
    };
    const { container } = render(<RecipeCard recipe={recipe} />);
    expect(container.querySelector("img")).toBeDefined();
  });

  it("uses aria-label on the link for accessibility", () => {
    render(<RecipeCard recipe={baseRecipe} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("aria-label")).toBe("Poulet rôti");
  });

  it("applies carousel-specific width class in carousel variant", () => {
    const { container } = render(
      <RecipeCard recipe={baseRecipe} variant="carousel" />
    );
    expect(container.querySelector("a")?.className).toContain("w-56");
  });

  it("applies full-width class in grid variant", () => {
    const { container } = render(
      <RecipeCard recipe={baseRecipe} variant="grid" />
    );
    expect(container.querySelector("a")?.className).toContain("w-full");
  });
});
