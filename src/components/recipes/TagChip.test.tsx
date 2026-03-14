// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import TagChip from "./TagChip";

afterEach(() => cleanup());

describe("TagChip", () => {
  it("renders the tag name", () => {
    render(<TagChip name="Végétarien" />);
    expect(screen.getByText("Végétarien")).not.toBeNull();
  });

  it("does not show a remove button by default (read-only)", () => {
    render(<TagChip name="Dessert" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a remove button when editable with onRemove", () => {
    const onRemove = vi.fn();
    render(<TagChip name="Soupe" editable onRemove={onRemove} />);
    const btn = screen.getByRole("button");
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-label")).toBe("Retirer le tag Soupe");
  });

  it("calls onRemove when the remove button is clicked", () => {
    const onRemove = vi.fn();
    render(<TagChip name="Rapide" editable onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("does not show remove button when editable but no onRemove provided", () => {
    render(<TagChip name="Facile" editable />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
