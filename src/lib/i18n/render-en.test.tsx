// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { LocaleProvider } from "./client";
import { en } from "./en";
import RecipeCard from "@/components/recipes/RecipeCard";
import MetadataGrid from "@/components/recipes/MetadataGrid";
import Navigation from "@/components/layout/Navigation";
import type { RecipeListItem } from "@/types/recipe";

// Test de fumée du rendu EN : quelques composants clients simples montés sous
// <LocaleProvider locale="en"> — le texte rendu ne doit contenir aucun
// marqueur français et doit contenir le libellé anglais attendu. Attrape un
// `import { t } from "@/lib/i18n/fr"` ou une chaîne FR en dur qui aurait
// échappé à la revue (le typage ne voit pas ça).

afterEach(() => cleanup());

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
}));

const FRENCH_MARKERS = /[éèêàçùœ«»]/;

const wrapper = ({ children }: { children: ReactNode }) => (
  <LocaleProvider locale="en">{children}</LocaleProvider>
);

const recipe: RecipeListItem = {
  id: "abc-123",
  title: "Roast chicken",
  ingredients: "1 chicken\nThyme",
  tags: [{ id: "t1", name: "viande", category: null }],
  photoUrl: null,
  createdAt: "2024-01-01T00:00:00Z",
  generatedImageUrl: null,
  enrichmentStatus: "none",
  imageStatus: "none",
};

describe("rendu EN sous LocaleProvider", () => {
  it("RecipeCard : sans accent FR, titre et alt anglais", () => {
    const { container } = render(<RecipeCard recipe={{ ...recipe, photoUrl: "https://example.supabase.co/storage/v1/object/public/recipe-photos/x.webp" }} />, { wrapper });
    expect(container.textContent).not.toMatch(FRENCH_MARKERS);
    expect(container.textContent).toContain("Roast chicken");
    expect(container.querySelector("img")?.getAttribute("alt")).toBe(en.a11y.recipePhoto("Roast chicken"));
  });

  it("MetadataGrid : libellés anglais, valeur stockée « facile » → « Easy »", () => {
    const { container } = render(
      <MetadataGrid prepTime={null} cookTime="Aucune" cost="€" complexity="facile" isLoading={false} />,
      { wrapper },
    );
    expect(container.textContent).not.toMatch(FRENCH_MARKERS);
    expect(container.textContent).toContain(en.metadata.complexity);
    expect(container.textContent).toContain(en.complexity.facile);
    expect(container.textContent).toContain(en.form.cookTimeNone);
    expect(container.textContent).not.toContain("Aucune");
  });

  it("Navigation : libellés (aria-label des liens, pas de texte visible) anglais", () => {
    const { container } = render(<Navigation />, { wrapper });
    const labels = Array.from(container.querySelectorAll("[aria-label]")).map((el) =>
      el.getAttribute("aria-label"),
    );
    expect(labels.join(" ")).not.toMatch(FRENCH_MARKERS);
    expect(screen.getAllByRole("link", { name: en.nav.library }).length).toBeGreaterThan(0);
    expect(container.querySelector("nav")?.getAttribute("aria-label")).toBe(en.a11y.mainNav);
  });
});
