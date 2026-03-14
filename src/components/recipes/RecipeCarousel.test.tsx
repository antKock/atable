// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import RecipeCarousel from "./RecipeCarousel";
import type { RecipeListItem } from "@/types/recipe";

afterEach(() => cleanup());

const recipe: RecipeListItem = {
  id: "1",
  title: "Tarte aux pommes",
  ingredients: null,
  tags: [{ id: "t1", name: "dessert", category: null }],
  photoUrl: null,
  createdAt: "2024-01-01T00:00:00Z",
  generatedImageUrl: null,
  enrichmentStatus: "none",
  imageStatus: "none",
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
    const recipes = [
      recipe,
      { ...recipe, id: "2", title: "Mousse au chocolat" },
    ];
    const { container } = render(
      <RecipeCarousel title="Desserts" recipes={recipes} />
    );
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);
  });

  it("renders a section with aria-label for accessibility", () => {
    const { container } = render(
      <RecipeCarousel title="rapide" recipes={[recipe]} />
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-label")).toContain("rapide");
  });
});
