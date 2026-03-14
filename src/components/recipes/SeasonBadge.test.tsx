// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import SeasonBadge from "./SeasonBadge";

afterEach(() => cleanup());

describe("SeasonBadge", () => {
  it("renders the French label for printemps", () => {
    render(<SeasonBadge season="printemps" />);
    expect(screen.getByText("Printemps")).not.toBeNull();
  });

  it("renders the French label for ete", () => {
    render(<SeasonBadge season="ete" />);
    expect(screen.getByText("Été")).not.toBeNull();
  });

  it("renders the French label for automne", () => {
    render(<SeasonBadge season="automne" />);
    expect(screen.getByText("Automne")).not.toBeNull();
  });

  it("renders the French label for hiver", () => {
    render(<SeasonBadge season="hiver" />);
    expect(screen.getByText("Hiver")).not.toBeNull();
  });

  it("falls back to the raw season string for unknown values", () => {
    render(<SeasonBadge season="unknown_season" />);
    expect(screen.getByText("unknown_season")).not.toBeNull();
  });

  it("applies inline style with season color", () => {
    const { container } = render(<SeasonBadge season="printemps" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("style")).toContain("color");
  });
});
