// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import ShimmerBlock from "./ShimmerBlock";

afterEach(() => cleanup());

describe("ShimmerBlock", () => {
  it("renders with aria-busy for accessibility", () => {
    const { container } = render(<ShimmerBlock variant="rect" />);
    const el = container.firstElementChild;
    expect(el?.getAttribute("aria-busy")).toBe("true");
  });

  it("applies the shimmer base class for animation", () => {
    const { container } = render(<ShimmerBlock variant="rect" />);
    expect(container.firstElementChild?.className).toContain("shimmer");
  });

  it("uses rounded-full for pill variant", () => {
    const { container } = render(<ShimmerBlock variant="pill" />);
    expect(container.firstElementChild?.className).toContain("rounded-full");
  });

  it("uses aspect-[4/3] for image variant", () => {
    const { container } = render(<ShimmerBlock variant="image" />);
    expect(container.firstElementChild?.className).toContain("aspect-[4/3]");
  });

  it("merges custom className", () => {
    const { container } = render(<ShimmerBlock variant="rect" className="w-24" />);
    expect(container.firstElementChild?.className).toContain("w-24");
  });
});
