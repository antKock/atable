// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { t } from "@/lib/i18n/fr";
import MetadataGrid from "./MetadataGrid";

afterEach(() => cleanup());

describe("MetadataGrid", () => {
  it("renders all four metadata labels", () => {
    render(
      <MetadataGrid prepTime={null} cookTime={null} cost={null} complexity={null} isLoading={false} />,
    );
    expect(screen.getByText(t.metadata.prepTime)).not.toBeNull();
    expect(screen.getByText(t.metadata.cookTime)).not.toBeNull();
    expect(screen.getByText(t.metadata.cost)).not.toBeNull();
    expect(screen.getByText(t.metadata.complexity)).not.toBeNull();
  });

  it("shows dash for null values when not loading", () => {
    render(
      <MetadataGrid prepTime={null} cookTime={null} cost={null} complexity={null} isLoading={false} />,
    );
    const dashes = screen.getAllByText("—");
    expect(dashes).toHaveLength(4);
  });

  it("shows actual values when provided", () => {
    render(
      <MetadataGrid prepTime="10-20 min" cookTime="< 15 min" cost="€" complexity="facile" isLoading={false} />,
    );
    expect(screen.getByText("10-20 min")).not.toBeNull();
    expect(screen.getByText("< 15 min")).not.toBeNull();
    expect(screen.getByText("€")).not.toBeNull();
    // Valeur stockée « facile » → libellé de la langue courante (défaut fr)
    expect(screen.getByText(t.complexity.facile)).not.toBeNull();
  });

  it("shows shimmer blocks when loading", () => {
    const { container } = render(
      <MetadataGrid prepTime={null} cookTime={null} cost={null} complexity={null} isLoading={true} />,
    );
    const shimmers = container.querySelectorAll("[aria-busy='true']");
    expect(shimmers.length).toBe(4);
  });

  it("has aria-live for enrichment completion announcements", () => {
    const { container } = render(
      <MetadataGrid prepTime={null} cookTime={null} cost={null} complexity={null} isLoading={false} />,
    );
    expect(container.querySelector("[aria-live='polite']")).not.toBeNull();
  });
});
