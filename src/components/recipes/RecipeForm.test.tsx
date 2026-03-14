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

// Mock fetch for TagInput's tag loading
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ tags: [] }),
});

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

  it("renders TagInput with combobox role", () => {
    render(<RecipeForm mode="create" />);
    expect(screen.getByRole("combobox", { name: "Tags" })).toBeDefined();
  });
});

describe("RecipeForm (edit mode)", () => {
  const initialData = {
    title: "Poulet rôti",
    ingredients: "1 poulet\nThym",
    steps: "Enfourner à 200°C",
    tags: [
      { id: "t1", name: "viande", category: null },
      { id: "t2", name: "four", category: null },
    ],
    photoUrl: null,
    prepTime: "20-30 min",
    cookTime: "1h - 2h",
    cost: "€€",
    complexity: "moyen",
    seasons: ["automne", "hiver"],
    generatedImageUrl: null,
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
    const ingredientsField = screen.getByLabelText(/Ingrédients/i) as HTMLTextAreaElement;
    expect(ingredientsField.value).toBe("1 poulet\nThym");
  });

  it("renders existing tags as chips in edit mode", () => {
    render(
      <RecipeForm mode="edit" recipeId="123" initialData={initialData} />
    );
    expect(screen.getByText("viande")).toBeDefined();
    expect(screen.getByText("four")).toBeDefined();
  });

  it("shows remove buttons for existing tags in edit mode", () => {
    render(
      <RecipeForm mode="edit" recipeId="123" initialData={initialData} />
    );
    expect(screen.getByLabelText("Retirer le tag viande")).toBeDefined();
    expect(screen.getByLabelText("Retirer le tag four")).toBeDefined();
  });

  it("pre-fills v3 metadata fields in edit mode", () => {
    render(
      <RecipeForm mode="edit" recipeId="123" initialData={initialData} />
    );
    const prepSelect = screen.getByLabelText("Prép.") as HTMLSelectElement;
    expect(prepSelect.value).toBe("20-30 min");
    const cookSelect = screen.getByLabelText("Cuisson") as HTMLSelectElement;
    expect(cookSelect.value).toBe("1h - 2h");
    const complexitySelect = screen.getByLabelText("Difficulté") as HTMLSelectElement;
    expect(complexitySelect.value).toBe("moyen");
  });

  it("pre-selects cost chip in edit mode", () => {
    render(
      <RecipeForm mode="edit" recipeId="123" initialData={initialData} />
    );
    const costChip = screen.getByRole("button", { name: "€€" });
    expect(costChip.getAttribute("aria-pressed")).toBe("true");
  });

  it("pre-selects season chips in edit mode", () => {
    render(
      <RecipeForm mode="edit" recipeId="123" initialData={initialData} />
    );
    const automne = screen.getByRole("button", { name: "Automne" });
    const hiver = screen.getByRole("button", { name: "Hiver" });
    expect(automne.getAttribute("aria-pressed")).toBe("true");
    expect(hiver.getAttribute("aria-pressed")).toBe("true");
    const printemps = screen.getByRole("button", { name: "Printemps" });
    expect(printemps.getAttribute("aria-pressed")).toBe("false");
  });
});
