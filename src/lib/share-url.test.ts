import { describe, expect, it } from "vitest";
import { buildShareUrl, shareLocaleFromSearchParam } from "./share-url";

describe("buildShareUrl", () => {
  it("locale par défaut (fr) : URL nue, identique à avant l'indice", () => {
    expect(buildShareUrl("https://mijote.test", "abc123", "fr")).toBe(
      "https://mijote.test/r/abc123",
    );
  });

  it("autre locale : l'indice ?l= est ajouté", () => {
    expect(buildShareUrl("https://mijote.test", "abc123", "en")).toBe(
      "https://mijote.test/r/abc123?l=en",
    );
  });
});

describe("shareLocaleFromSearchParam", () => {
  it("valeur valide → locale", () => {
    expect(shareLocaleFromSearchParam("en")).toBe("en");
    expect(shareLocaleFromSearchParam("fr")).toBe("fr");
  });

  it("absente, inconnue ou répétée → null", () => {
    expect(shareLocaleFromSearchParam(undefined)).toBeNull();
    expect(shareLocaleFromSearchParam("de")).toBeNull();
    expect(shareLocaleFromSearchParam("EN")).toBeNull();
    expect(shareLocaleFromSearchParam(["en", "fr"])).toBeNull();
  });
});
