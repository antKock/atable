import { describe, expect, it } from "vitest";
import { localeForTag, parseAcceptLanguage, readI18nFlags, resolveLocale } from "./locale";

describe("localeForTag", () => {
  it("fr et variantes (tiret, underscore, casse) → fr", () => {
    expect(localeForTag("fr")).toBe("fr");
    expect(localeForTag("fr-FR")).toBe("fr");
    expect(localeForTag("fr_FR")).toBe("fr");
    expect(localeForTag("FR-ca")).toBe("fr");
    expect(localeForTag(" fr-BE ")).toBe("fr");
  });
  it("tout autre tag → en, absent → défaut fr", () => {
    expect(localeForTag("en-GB")).toBe("en");
    expect(localeForTag("de")).toBe("en");
    // « frr » (frison) ou « fra-x » ne sont pas du français
    expect(localeForTag("frr")).toBe("en");
    expect(localeForTag(null)).toBe("fr");
    expect(localeForTag("")).toBe("fr");
  });
});

describe("parseAcceptLanguage", () => {
  it("défaut fr sans header (absent, null, vide)", () => {
    expect(parseAcceptLanguage(undefined)).toBe("fr");
    expect(parseAcceptLanguage(null)).toBe("fr");
    expect(parseAcceptLanguage("")).toBe("fr");
  });
  it("fr et variantes régionales → fr", () => {
    expect(parseAcceptLanguage("fr")).toBe("fr");
    expect(parseAcceptLanguage("fr-CA,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(parseAcceptLanguage("FR-fr")).toBe("fr");
    expect(parseAcceptLanguage("fr_FR")).toBe("fr");
  });
  it("toute autre langue → en", () => {
    expect(parseAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(parseAcceptLanguage("en-GB")).toBe("en");
    expect(parseAcceptLanguage("de-DE,de;q=0.9,fr;q=0.8")).toBe("en");
  });
  it("respecte les poids q, pas l'ordre d'apparition", () => {
    expect(parseAcceptLanguage("en;q=0.5,fr;q=0.9")).toBe("fr");
    expect(parseAcceptLanguage("fr;q=0,en")).toBe("en");
  });
  it("q= insensible à la casse et aux espaces", () => {
    expect(parseAcceptLanguage("en;Q=0.5,fr;Q=0.9")).toBe("fr");
    expect(parseAcceptLanguage("en ; q=0.5 , fr ; q=0.9")).toBe("fr");
  });
  it("q invalide → entrée ignorée, les autres restent prises en compte", () => {
    expect(parseAcceptLanguage("fr;q=abc,en;q=0.8")).toBe("en");
    expect(parseAcceptLanguage("en;q=abc,fr;q=0.8")).toBe("fr");
    // Toutes invalides → défaut
    expect(parseAcceptLanguage("en;q=abc")).toBe("fr");
  });
  it("ignore le joker, seul ou pondéré", () => {
    expect(parseAcceptLanguage("*")).toBe("fr");
    expect(parseAcceptLanguage("*;q=0.9,fr;q=0.8")).toBe("fr");
    expect(parseAcceptLanguage("*;q=0.9,en;q=0.8")).toBe("en");
  });
});

describe("resolveLocale", () => {
  it("tout éteint → fr quoi qu'il arrive (rollback : retirer I18N_EN_ENABLED)", () => {
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

describe("readI18nFlags", () => {
  const flags = (value: string | undefined) =>
    readI18nFlags({ I18N_EN_ENABLED: value, I18N_PREVIEW_COOKIE: value });

  it("« 1 » et « true » (casse, espaces) allument les deux flags", () => {
    for (const value of ["1", "true", "TRUE ", " True"]) {
      expect(flags(value), `valeur ${JSON.stringify(value)}`).toEqual({ enEnabled: true, previewEnabled: true });
    }
  });
  it("« 0 », vide, absent → éteint", () => {
    for (const value of ["0", "", undefined, "false", "yes"]) {
      expect(flags(value), `valeur ${JSON.stringify(value)}`).toEqual({ enEnabled: false, previewEnabled: false });
    }
  });
  it("les deux flags sont indépendants", () => {
    expect(readI18nFlags({ I18N_EN_ENABLED: "1" })).toEqual({
      enEnabled: true,
      previewEnabled: false,
    });
  });
});
