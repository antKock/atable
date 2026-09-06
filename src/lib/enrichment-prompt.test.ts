import { describe, it, expect } from "vitest";
import { buildEnrichmentSchema, buildSystemPrompt, sanitizeDietTags } from "./enrichment-prompt";

describe("buildEnrichmentSchema", () => {
  const names = ["Dessert", "Végétarien", "Sauce / Condiment"];

  it("sans enum : tags = chaînes libres (état historique)", () => {
    const schema = buildEnrichmentSchema(names, { enumTags: false });
    expect(schema.name).toBe("enrichment");
    expect(schema.strict).toBe(true);
    expect(schema.schema).toMatchObject({
      properties: { tags: { type: "array", items: { type: "string" }, maxItems: 10 } },
      additionalProperties: false,
    });
  });

  it("avec enum : tags contraints aux noms prédéfinis, tels quels", () => {
    const schema = buildEnrichmentSchema(names, { enumTags: true });
    expect(schema.schema).toMatchObject({
      properties: { tags: { items: { type: "string", enum: names } } },
    });
  });

  it("liste vide : pas d'enum même si demandé (un enum vide est refusé par l'API)", () => {
    expect(buildEnrichmentSchema([], { enumTags: true }).schema).toMatchObject({
      properties: { tags: { items: { type: "string" } } },
    });
  });

  it("seul `tags` diffère entre les deux variantes", () => {
    const properties = (enumTags: boolean) =>
      buildEnrichmentSchema(names, { enumTags }).schema?.properties as Record<string, unknown>;
    expect({ ...properties(true), tags: null }).toEqual({ ...properties(false), tags: null });
  });
});

describe("buildSystemPrompt", () => {
  it("liste chaque tag avec sa définition quand elle existe", () => {
    const prompt = buildSystemPrompt([
      { name: "Végétarien", description: "STRICT : aucune viande" },
      { name: "Poisson", description: null },
    ]);
    expect(prompt).toContain("- Végétarien : STRICT : aucune viande\n- Poisson\n");
  });
});

describe("sanitizeDietTags", () => {
  it("drops Végétarien when an animal-protein tag is present", () => {
    expect(sanitizeDietTags(["Poisson", "Végétarien", "Plat principal"]))
      .toEqual(["Poisson", "Plat principal"]);
    expect(sanitizeDietTags(["Fruits de mer", "Végétarien"])).toEqual(["Fruits de mer"]);
    expect(sanitizeDietTags(["Poulet", "Végétarien", "Végan"])).toEqual(["Poulet"]);
  });

  it("drops Végan (but not Végétarien) when Œufs is present", () => {
    expect(sanitizeDietTags(["Œufs", "Végétarien", "Végan"])).toEqual(["Œufs", "Végétarien"]);
  });

  it("keeps diet tags on genuinely vegetarian recipes", () => {
    expect(sanitizeDietTags(["Légumineuses", "Végétarien", "Végan", "Indienne"]))
      .toEqual(["Légumineuses", "Végétarien", "Végan", "Indienne"]);
  });
});
