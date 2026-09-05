import { describe, expect, it } from "vitest";
import { parseAcceptLanguage, resolveLocale } from "./locale";

describe("parseAcceptLanguage", () => {
  it("défaut fr sans header", () => {
    expect(parseAcceptLanguage(null)).toBe("fr");
    expect(parseAcceptLanguage("")).toBe("fr");
  });
  it("fr et variantes régionales → fr", () => {
    expect(parseAcceptLanguage("fr")).toBe("fr");
    expect(parseAcceptLanguage("fr-CA,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(parseAcceptLanguage("FR-fr")).toBe("fr");
  });
  it("toute autre langue → en", () => {
    expect(parseAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(parseAcceptLanguage("de-DE,de;q=0.9,fr;q=0.8")).toBe("en");
  });
  it("respecte les poids q, pas l'ordre d'apparition", () => {
    expect(parseAcceptLanguage("en;q=0.5,fr;q=0.9")).toBe("fr");
    expect(parseAcceptLanguage("fr;q=0,en")).toBe("en");
  });
  it("ignore le joker seul", () => {
    expect(parseAcceptLanguage("*")).toBe("fr");
  });
});

describe("resolveLocale", () => {
  it("tout éteint → fr quoi qu'il arrive", () => {
    expect(
      resolveLocale({ acceptLanguage: "en-US", previewCookie: "en", enEnabled: false, previewEnabled: false }),
    ).toBe("fr");
  });
  it("EN activé → suit Accept-Language", () => {
    expect(resolveLocale({ acceptLanguage: "en-US", enEnabled: true, previewEnabled: false })).toBe("en");
    expect(resolveLocale({ acceptLanguage: "fr-FR", enEnabled: true, previewEnabled: false })).toBe("fr");
  });
  it("cookie de prévisualisation honoré seulement si le flag est posé", () => {
    expect(resolveLocale({ previewCookie: "en", enEnabled: false, previewEnabled: true })).toBe("en");
    expect(resolveLocale({ previewCookie: "en", enEnabled: false, previewEnabled: false })).toBe("fr");
  });
  it("cookie de prévisualisation prime sur Accept-Language", () => {
    expect(
      resolveLocale({ previewCookie: "fr", acceptLanguage: "en-US", enEnabled: true, previewEnabled: true }),
    ).toBe("fr");
  });
  it("cookie invalide ignoré", () => {
    expect(resolveLocale({ previewCookie: "de", acceptLanguage: "en", enEnabled: true, previewEnabled: true })).toBe(
      "en",
    );
  });
});
