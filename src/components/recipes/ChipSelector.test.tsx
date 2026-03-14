// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ChipSelector from "./ChipSelector";

afterEach(() => cleanup());

const options = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

describe("ChipSelector (single)", () => {
  it("renders all options as buttons", () => {
    render(<ChipSelector options={options} selected="" onChange={() => {}} mode="single" label="Test" />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("marks the selected option as pressed", () => {
    render(<ChipSelector options={options} selected="b" onChange={() => {}} mode="single" label="Test" />);
    expect(screen.getByRole("button", { name: "Option B" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Option A" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("calls onChange with the value when clicked", () => {
    const onChange = vi.fn();
    render(<ChipSelector options={options} selected="" onChange={onChange} mode="single" label="Test" />);
    fireEvent.click(screen.getByRole("button", { name: "Option A" }));
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("deselects when clicking the already selected option", () => {
    const onChange = vi.fn();
    render(<ChipSelector options={options} selected="a" onChange={onChange} mode="single" label="Test" />);
    fireEvent.click(screen.getByRole("button", { name: "Option A" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("has role=group with aria-label", () => {
    render(<ChipSelector options={options} selected="" onChange={() => {}} mode="single" label="Coût" />);
    expect(screen.getByRole("group", { name: "Coût" })).toBeDefined();
  });
});

describe("ChipSelector (multi)", () => {
  it("allows multiple selections", () => {
    render(<ChipSelector options={options} selected={["a", "c"]} onChange={() => {}} mode="multi" label="Test" />);
    expect(screen.getByRole("button", { name: "Option A" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Option B" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Option C" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("adds to selection when clicking unselected", () => {
    const onChange = vi.fn();
    render(<ChipSelector options={options} selected={["a"]} onChange={onChange} mode="multi" label="Test" />);
    fireEvent.click(screen.getByRole("button", { name: "Option B" }));
    expect(onChange).toHaveBeenCalledWith(["a", "b"]);
  });

  it("removes from selection when clicking selected", () => {
    const onChange = vi.fn();
    render(<ChipSelector options={options} selected={["a", "b"]} onChange={onChange} mode="multi" label="Test" />);
    fireEvent.click(screen.getByRole("button", { name: "Option A" }));
    expect(onChange).toHaveBeenCalledWith(["b"]);
  });
});
