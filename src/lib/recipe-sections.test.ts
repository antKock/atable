import { describe, it, expect } from "vitest";
import { parseSections, isSectionLine } from "./recipe-sections";

describe("isSectionLine", () => {
  it("matches '// Nom' with and without space", () => {
    expect(isSectionLine("// Pour la sauce")).toBe(true);
    expect(isSectionLine("//Pour la sauce")).toBe(true);
  });

  it("does not match regular lines or mid-line slashes", () => {
    expect(isSectionLine("200 g de farine")).toBe(false);
    expect(isSectionLine("Mélanger 50/50")).toBe(false);
    expect(isSectionLine("/ une seule barre")).toBe(false);
  });
});

describe("parseSections", () => {
  it("returns [] for null or blank text", () => {
    expect(parseSections(null)).toEqual([]);
    expect(parseSections("")).toEqual([]);
    expect(parseSections("  \n \n")).toEqual([]);
  });

  it("wraps unsectioned text in a single untitled section", () => {
    expect(parseSections("Pommes\nSucre")).toEqual([
      { title: null, items: ["Pommes", "Sucre"] },
    ]);
  });

  it("groups lines under their '//' section", () => {
    expect(
      parseSections("// Pour la sauce\nBeurre\nFarine\n// Pour le poulet\nPoulet"),
    ).toEqual([
      { title: "Pour la sauce", items: ["Beurre", "Farine"] },
      { title: "Pour le poulet", items: ["Poulet"] },
    ]);
  });

  it("keeps lines before the first marker in a leading untitled section", () => {
    expect(parseSections("Sel\n// Pour la pâte\nFarine")).toEqual([
      { title: null, items: ["Sel"] },
      { title: "Pour la pâte", items: ["Farine"] },
    ]);
  });

  it("treats a bare '//' as an untitled section break", () => {
    expect(parseSections("// \nFarine")).toEqual([
      { title: null, items: ["Farine"] },
    ]);
  });

  it("keeps a trailing empty section", () => {
    expect(parseSections("Farine\n// Pour la sauce")).toEqual([
      { title: null, items: ["Farine"] },
      { title: "Pour la sauce", items: [] },
    ]);
  });

  it("trims lines and drops blank ones", () => {
    expect(parseSections("  //  Pâte  \n  Farine  \n\n Oeufs ")).toEqual([
      { title: "Pâte", items: ["Farine", "Oeufs"] },
    ]);
  });
});
