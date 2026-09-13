import { describe, expect, it } from "vitest";
import {
  isAbOnboardingEnabled,
  isCrawlerUa,
  isIosNativeUa,
  resolveAssignment,
  variantForNewOwner,
} from "./ab-onboarding";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_NATIVE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MijoteNative/1.3";

describe("isAbOnboardingEnabled", () => {
  it("1 / true (insensible à la casse et aux espaces) = actif, le reste éteint", () => {
    expect(isAbOnboardingEnabled({ AB_ONBOARDING_ENABLED: "1" })).toBe(true);
    expect(isAbOnboardingEnabled({ AB_ONBOARDING_ENABLED: " TRUE " })).toBe(true);
    expect(isAbOnboardingEnabled({ AB_ONBOARDING_ENABLED: "0" })).toBe(false);
    expect(isAbOnboardingEnabled({ AB_ONBOARDING_ENABLED: "yes" })).toBe(false);
    expect(isAbOnboardingEnabled({})).toBe(false);
  });
});

describe("resolveAssignment", () => {
  it("flag éteint → rien (tout le monde en A, pas de cookie)", () => {
    expect(resolveAssignment({ enabled: false, cookie: "b", ua: IPHONE_SAFARI })).toBeNull();
  });

  it("cookie valide → respecté, pas de nouveau tirage", () => {
    expect(resolveAssignment({ enabled: true, cookie: "b", ua: IPHONE_SAFARI })).toEqual({
      variant: "b",
      fresh: false,
    });
  });

  it("cookie invalide → nouveau tirage", () => {
    expect(
      resolveAssignment({ enabled: true, cookie: "zz", ua: IPHONE_SAFARI, random: () => 0.2 }),
    ).toEqual({ variant: "a", fresh: true });
  });

  it("tirage 50/50 : < 0,5 → a, sinon b", () => {
    expect(
      resolveAssignment({
        enabled: true,
        cookie: undefined,
        ua: IPHONE_SAFARI,
        random: () => 0.49,
      }),
    ).toEqual({ variant: "a", fresh: true });
    expect(
      resolveAssignment({ enabled: true, cookie: undefined, ua: IPHONE_SAFARI, random: () => 0.5 }),
    ).toEqual({ variant: "b", fresh: true });
  });

  it("crawler → pas d'affectation", () => {
    expect(
      resolveAssignment({
        enabled: true,
        cookie: undefined,
        ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      }),
    ).toBeNull();
  });
});

describe("user-agents", () => {
  it("crawlers connus vs navigateurs (Playwright headless n'est pas un crawler)", () => {
    expect(isCrawlerUa("Mozilla/5.0 (compatible; bingbot/2.0)")).toBe(true);
    expect(isCrawlerUa("Mozilla/5.0 (Macintosh) HeadlessChrome/120.0")).toBe(false);
    expect(isCrawlerUa(IPHONE_SAFARI)).toBe(false);
  });

  it("shell natif iOS = MijoteNative sur iPhone/iPad, pas Safari iOS ni Android natif", () => {
    expect(isIosNativeUa(IPHONE_NATIVE)).toBe(true);
    expect(isIosNativeUa(IPHONE_SAFARI)).toBe(false);
    expect(isIosNativeUa("Mozilla/5.0 (Linux; Android 14) MijoteNative/1.3")).toBe(false);
  });
});

describe("variantForNewOwner", () => {
  it("cookie valide et test actif → bras ; sinon null", () => {
    expect(variantForNewOwner("a", true)).toBe("a");
    expect(variantForNewOwner("b", true)).toBe("b");
    expect(variantForNewOwner("b", false)).toBeNull();
    expect(variantForNewOwner(undefined, true)).toBeNull();
    expect(variantForNewOwner("x", true)).toBeNull();
  });
});
