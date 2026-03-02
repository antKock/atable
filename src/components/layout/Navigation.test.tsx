// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Navigation from "./Navigation";

afterEach(() => cleanup());

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
}));

describe("Navigation", () => {
  it("renders all three navigation items (Story 1.4)", () => {
    render(<Navigation />);
    expect(screen.getAllByText("Accueil").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bibliothèque").length).toBeGreaterThan(0);
    const addLinks = screen.getAllByRole("link", { name: /ajouter/i });
    expect(addLinks.length).toBeGreaterThan(0);
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

  it("renders two nav elements (mobile bottom + desktop side rail)", () => {
    const { container } = render(<Navigation />);
    expect(container.querySelectorAll("nav").length).toBe(2);
  });

  it("hides mobile nav on large screens via lg:hidden class (Story 1.4)", () => {
    const { container } = render(<Navigation />);
    // Mobile nav uses lg:hidden; desktop rail uses lg:flex
    const navElements = container.querySelectorAll("nav");
    const mobileNav = navElements[0];
    const desktopNav = navElements[1];
    expect(mobileNav.className).toContain("lg:hidden");
    expect(desktopNav.className).toContain("lg:flex");
  });
});
