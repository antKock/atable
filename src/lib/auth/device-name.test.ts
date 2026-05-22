import { describe, it, expect } from "vitest";
import { getDeviceName } from "./device-name";

const SEP = " · "; // U+00B7 middle dot

describe("getDeviceName", () => {
  it("returns the full fallback for an empty user-agent", () => {
    expect(getDeviceName("")).toBe(`Appareil inconnu${SEP}Navigateur inconnu`);
  });

  it("identifies an iPhone on Safari", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const name = getDeviceName(ua);
    expect(name).toContain("iPhone");
    expect(name).toContain("Safari");
    expect(name).toContain(SEP);
  });

  it("identifies an Android device on Chrome", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    const name = getDeviceName(ua);
    expect(name).toContain("Android");
    expect(name).toContain("Chrome");
  });

  it("falls back to the OS name when there is no device model (desktop)", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    const name = getDeviceName(ua);
    expect(name).toContain("Chrome");
    expect(name).toContain(SEP);
    // No model on desktop → device part is the OS, not "Appareil inconnu"
    expect(name).not.toContain("Appareil inconnu");
  });

  it("never throws and always returns a separated string", () => {
    const name = getDeviceName("totally-garbage-ua-string");
    expect(typeof name).toBe("string");
    expect(name).toContain(SEP);
  });
});
