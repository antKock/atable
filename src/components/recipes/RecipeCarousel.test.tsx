// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import RecipeCarousel from "./RecipeCarousel";
import type { CarouselRecipeItem } from "@/lib/queries/carousels";

afterEach(() => cleanup());

const recipe: CarouselRecipeItem = {
  id: "1",
  title: "Tarte aux pommes",
  ingredients: null,
  tags: [{ id: "t1", name: "dessert", category: null }],
  photoUrl: null,
  createdAt: "2024-01-01T00:00:00Z",
  generatedImageUrl: null,
  enrichmentStatus: "none",
  imageStatus: "none",
  prepTime: "10-20 min",
  cookTime: "30-60 min",
  cost: "€",
};

describe("RecipeCarousel", () => {
  it("returns null when recipes array is empty (FR9)", () => {
    const { container } = render(
      <RecipeCarousel title="Desserts" recipes={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the carousel title when recipes exist", () => {
    render(<RecipeCarousel title="Desserts" recipes={[recipe]} />);
    expect(screen.getByText("Desserts")).toBeDefined();
  });

  it("renders a card link for each recipe", () => {
    const recipes: CarouselRecipeItem[] = [
      recipe,
      { ...recipe, id: "2", title: "Mousse au chocolat" },
    ];
    const { container } = render(
      <RecipeCarousel title="Desserts" recipes={recipes} />
    );
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);
  });

  it("renders a section with role=region and aria-label for accessibility", () => {
    const { container } = render(
      <RecipeCarousel title="rapide" recipes={[recipe]} />
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("role")).toBe("region");
    expect(section?.getAttribute("aria-label")).toContain("rapide");
  });
});
