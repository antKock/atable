import { describe, expect, it } from "vitest";
import { detectProbe, isProbeHeaders } from "./probe";

describe("detectProbe (#26)", () => {
  it("cookie, en-tête ou ?probe=1 → sonde ; le cookie n'est posé que depuis le paramètre", () => {
    expect(detectProbe({ cookie: undefined, header: null, queryParam: null })).toEqual({
      probe: false,
      setCookie: false,
    });
    expect(detectProbe({ cookie: "1", header: null, queryParam: null })).toEqual({
      probe: true,
      setCookie: false,
    });
    expect(detectProbe({ cookie: undefined, header: "1", queryParam: null })).toEqual({
      probe: true,
      setCookie: false,
    });
    expect(detectProbe({ cookie: undefined, header: null, queryParam: "1" })).toEqual({
      probe: true,
      setCookie: true,
    });
    // Déjà marqué : pas de re-pose
    expect(detectProbe({ cookie: "1", header: null, queryParam: "1" })).toEqual({
      probe: true,
      setCookie: false,
    });
    // Valeurs quelconques ≠ "1" : pas une sonde
    expect(detectProbe({ cookie: "0", header: "yes", queryParam: "true" }).probe).toBe(false);
  });

  it("isProbeHeaders ne lit que l'en-tête interne x-probe", () => {
    expect(isProbeHeaders(new Headers({ "x-probe": "1" }))).toBe(true);
    expect(isProbeHeaders(new Headers({ "x-mijote-probe": "1" }))).toBe(false);
    expect(isProbeHeaders(new Headers())).toBe(false);
  });
});
