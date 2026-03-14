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
  tags: [{ id: "t1", name: "viande", category: null }],
  photoUrl: null,
  createdAt: "2024-01-01T00:00:00Z",
  generatedImageUrl: null,
  enrichmentStatus: "none",
  imageStatus: "none",
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

  it("shows a warm placeholder when no photo or generated image is provided", () => {
    const { container } = render(<RecipeCard recipe={baseRecipe} />);
    expect(container.querySelector("img")).toBeNull();
    // Placeholder uses inline style background gradient, not an img element
    const placeholderDiv = container.querySelector("[style]");
    expect(placeholderDiv).not.toBeNull();
  });

  it("renders an img element when photoUrl is provided", () => {
    const recipe = {
      ...baseRecipe,
      photoUrl:
        "https://example.supabase.co/storage/v1/object/public/recipe-photos/device/recipe/photo.webp",
    };
    const { container } = render(<RecipeCard recipe={recipe} />);
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("renders an img element when generatedImageUrl is provided and photoUrl is null", () => {
    const recipe = {
      ...baseRecipe,
      generatedImageUrl:
        "https://example.supabase.co/storage/v1/object/public/recipe-photos/generated/abc-123/ai-image.webp",
    };
    const { container } = render(<RecipeCard recipe={recipe} />);
    expect(container.querySelector("img")).not.toBeNull();
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
