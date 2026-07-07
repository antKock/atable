// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import RecipeView from "./RecipeView";
import type { Recipe } from "@/types/recipe";

afterEach(() => cleanup());

const baseRecipe: Recipe = {
  id: "abc-123",
  userId: null,
  title: "Poulet sauce forestière",
  ingredients: "1 poulet\nChampignons",
  steps: "Saisir le poulet\nAjouter les champignons",
  notes: null,
  tags: [],
  photoUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  prepTime: null,
  cookTime: null,
  cost: null,
  complexity: null,
  seasons: [],
  imagePrompt: null,
  generatedImageUrl: null,
  enrichmentStatus: "none",
  imageStatus: "none",
  lastViewedAt: null,
  viewCount: 0,
  servings: null,
};

describe("RecipeView — servings suffix (spec #12)", () => {
  it("shows « pour N pers. » next to the Ingrédients heading", () => {
    render(<RecipeView recipe={{ ...baseRecipe, servings: 4 }} />);
    const heading = screen.getByRole("heading", { name: /Ingrédients/ });
    expect(heading.textContent).toContain("— pour 4 pers.");
  });

  it("shows the singular form for 1 person", () => {
    render(<RecipeView recipe={{ ...baseRecipe, servings: 1 }} />);
    const heading = screen.getByRole("heading", { name: /Ingrédients/ });
    expect(heading.textContent).toContain("— pour 1 pers.");
  });

  it("renders no suffix when servings is null", () => {
    render(<RecipeView recipe={baseRecipe} />);
    const heading = screen.getByRole("heading", { name: /Ingrédients/ });
    expect(heading.textContent).not.toContain("pour");
  });
});

describe("RecipeView — flat lists (no sections)", () => {
  it("renders each ingredient line as a list item", () => {
    render(<RecipeView recipe={baseRecipe} />);
    expect(screen.getByText("1 poulet")).not.toBeNull();
    expect(screen.getByText("Champignons")).not.toBeNull();
  });

  it("numbers steps from 1 without any section heading", () => {
    const { container } = render(<RecipeView recipe={baseRecipe} />);
    const numbers = [...container.querySelectorAll("ol li span")].map(
      (el) => el.textContent,
    );
    expect(numbers).toEqual(["1", "2"]);
    expect(container.querySelector("h3")).toBeNull();
  });
});

describe("RecipeView — '//' sections", () => {
  const sectioned: Recipe = {
    ...baseRecipe,
    ingredients: "// Pour le poulet\n1 poulet\n// Pour la sauce\nChampignons\nCrème",
    steps: "// Pour le poulet\nSaisir le poulet\nEnfourner\n// Pour la sauce\nRéduire la crème",
  };

  it("renders section titles as headings", () => {
    render(<RecipeView recipe={sectioned} />);
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "Pour le poulet",
      "Pour la sauce",
      "Pour le poulet",
      "Pour la sauce",
    ]);
  });

  it("restarts step numbering at 1 in each section", () => {
    const { container } = render(<RecipeView recipe={sectioned} />);
    const numbers = [...container.querySelectorAll("ol li span")].map(
      (el) => el.textContent,
    );
    expect(numbers).toEqual(["1", "2", "1"]);
  });

  it("groups ingredients under their section", () => {
    const { container } = render(<RecipeView recipe={sectioned} />);
    const lists = container.querySelectorAll("ul");
    expect(lists.length).toBe(2);
    expect(lists[0].textContent).toContain("1 poulet");
    expect(lists[1].textContent).toContain("Crème");
  });

  it("keeps lines before the first marker in an untitled leading group", () => {
    const recipe = {
      ...baseRecipe,
      steps: "Préchauffer le four\n// Pour la sauce\nRéduire la crème",
    };
    const { container } = render(<RecipeView recipe={recipe} />);
    const headings = [...container.querySelectorAll("h3")].map(
      (h) => h.textContent,
    );
    expect(headings).toEqual(["Pour la sauce"]);
    const numbers = [...container.querySelectorAll("ol li span")].map(
      (el) => el.textContent,
    );
    expect(numbers).toEqual(["1", "1"]);
  });
});

describe("RecipeView — notes (spec #13)", () => {
  it("renders the notes text as recorded, not as a list", () => {
    const { container } = render(
      <RecipeView
        recipe={{ ...baseRecipe, notes: "Se congèle très bien.\nEncore meilleur le lendemain." }}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Notes" })
    ).not.toBeNull();
    const notesSection = container.querySelector(
      'section[aria-labelledby="notes-heading"]'
    );
    expect(notesSection?.querySelector("ul, ol")).toBeNull();
    expect(notesSection?.textContent).toContain(
      "Se congèle très bien.\nEncore meilleur le lendemain."
    );
  });

  it("renders no Notes section when notes is null or blank", () => {
    render(<RecipeView recipe={baseRecipe} />);
    expect(screen.queryByRole("heading", { name: "Notes" })).toBeNull();
    cleanup();
    render(<RecipeView recipe={{ ...baseRecipe, notes: "  \n " }} />);
    expect(screen.queryByRole("heading", { name: "Notes" })).toBeNull();
  });
});
