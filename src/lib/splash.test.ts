import { describe, it, expect, vi, beforeEach } from "vitest";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { hideNativeSplash } from "./splash";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));
vi.mock("@capacitor/splash-screen", () => ({
  SplashScreen: { hide: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hideNativeSplash", () => {
  it("does nothing when not on a native platform", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    await hideNativeSplash();
    expect(SplashScreen.hide).not.toHaveBeenCalled();
  });

  it("calls SplashScreen.hide() on a native platform", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    await hideNativeSplash();
    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
  });

  it("never throws when the native call fails", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(SplashScreen.hide).mockRejectedValueOnce(new Error("no splash"));
    await expect(hideNativeSplash()).resolves.toBeUndefined();
  });
});
