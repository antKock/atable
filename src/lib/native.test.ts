import { describe, it, expect, vi, afterEach } from "vitest";
import { Capacitor } from "@capacitor/core";
import { isNativeApp } from "./native";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
});

describe("isNativeApp", () => {
  it("is true when Capacitor reports a native platform", () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    expect(isNativeApp()).toBe(true);
  });

  it("is true when the user-agent carries the native marker", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 MijoteNative/1.0" });
    expect(isNativeApp()).toBe(true);
  });

  it("is true when the URL has the ?native flag", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0" });
    vi.stubGlobal("window", { location: { search: "?native=1" } });
    expect(isNativeApp()).toBe(true);
  });

  it("is false in a plain web browser", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Safari" });
    vi.stubGlobal("window", { location: { search: "" } });
    expect(isNativeApp()).toBe(false);
  });
});
