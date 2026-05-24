// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Navigation from "./Navigation";

afterEach(() => cleanup());

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
}));

describe("Navigation", () => {
  it("exposes all three navigation items via aria-label (Lot 6 pill)", () => {
    render(<Navigation />);
    expect(screen.getAllByRole("link", { name: /accueil/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /bibliothèque/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /ajouter/i }).length).toBeGreaterThan(0);
  });

  it("renders links pointing to correct hrefs", () => {
    const { container } = render(<Navigation />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).toContain("/home");
    expect(hrefs).toContain("/library");
    expect(hrefs).toContain("/recipes/new");
  });

  it("marks the active route with aria-current=page (Story 1.4)", () => {
    render(<Navigation />);
    const activeLinks = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page");
    expect(activeLinks.length).toBeGreaterThan(0);
    expect(activeLinks[0].getAttribute("href")).toBe("/home");
  });

  it("renders a single floating pill nav (Lot 6 unification)", () => {
    const { container } = render(<Navigation />);
    expect(container.querySelectorAll("nav").length).toBe(1);
  });

  it("pill is centered horizontally and fixed at bottom (Lot 6)", () => {
    const { container } = render(<Navigation />);
    const nav = container.querySelector("nav")!;
    expect(nav.className).toContain("fixed");
    expect(nav.className).toContain("left-1/2");
    expect(nav.className).toContain("z-50");
  });
});
