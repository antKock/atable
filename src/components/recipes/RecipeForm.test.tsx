// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import RecipeForm from "./RecipeForm";

afterEach(() => cleanup());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/usePhotoUpload", () => ({
  usePhotoUpload: () => ({ uploadPhoto: vi.fn() }),
}));

describe("RecipeForm (create mode)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("auto-focuses the title field on mount (FR14)", () => {
    render(<RecipeForm mode="create" />);
    const titleInput = screen.getByPlaceholderText("Nom de la recette");
    expect(document.activeElement).toBe(titleInput);
  });

  it("disables the save button when title is empty (FR15)", () => {
    render(<RecipeForm mode="create" />);
    const saveButton = screen.getByRole("button", { name: "Enregistrer" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables the save button once title has content (FR15)", () => {
    render(<RecipeForm mode="create" />);
    const titleInput = screen.getByPlaceholderText("Nom de la recette");
    fireEvent.change(titleInput, { target: { value: "Soupe" } });
    const saveButton = screen.getByRole("button", { name: "Enregistrer" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("re-disables the save button when title is cleared", () => {
    render(<RecipeForm mode="create" />);
    const titleInput = screen.getByPlaceholderText("Nom de la recette");
    fireEvent.change(titleInput, { target: { value: "Soupe" } });
    fireEvent.change(titleInput, { target: { value: "" } });
    const saveButton = screen.getByRole("button", { name: "Enregistrer" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("uses fr.ts string for the tags helper text (H5 regression)", () => {
    render(<RecipeForm mode="create" />);
    expect(screen.getByText("Séparez les tags par des virgules")).toBeDefined();
  });
});

describe("RecipeForm (edit mode)", () => {
  const initialData = {
    title: "Poulet rôti",
    ingredients: "1 poulet\nThym",
    steps: "Enfourner à 200°C",
    tags: ["viande", "four"],
    photoUrl: null,
  };

  it("does NOT auto-focus the title field in edit mode", () => {
    render(
      <RecipeForm mode="edit" recipeId="123" initialData={initialData} />
    );
    const titleInput = screen.getByDisplayValue("Poulet rôti");
    expect(document.activeElement).not.toBe(titleInput);
  });

  it("pre-fills the title field with existing data (Story 5.2)", () => {
    render(
      <RecipeForm mode="edit" recipeId="123" initialData={initialData} />
    );
    expect(screen.getByDisplayValue("Poulet rôti")).toBeDefined();
  });

  it("pre-fills the ingredients field", () => {
    render(
      <RecipeForm mode="edit" recipeId="123" initialData={initialData} />
    );
    // getByLabelText is more reliable for multiline textarea values
    const ingredientsField = screen.getByLabelText(/Ingrédients/i) as HTMLTextAreaElement;
    expect(ingredientsField.value).toBe("1 poulet\nThym");
  });

  it("pre-fills the tags as a comma-separated string", () => {
    render(
      <RecipeForm mode="edit" recipeId="123" initialData={initialData} />
    );
    expect(screen.getByDisplayValue("viande, four")).toBeDefined();
  });
});
