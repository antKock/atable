import { describe, it, expect, vi, beforeEach } from "vitest";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { haptics } from "./haptics";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));
vi.mock("@capacitor/haptics", () => ({
  Haptics: { impact: vi.fn(), notification: vi.fn() },
  ImpactStyle: { Light: "LIGHT", Medium: "MEDIUM", Heavy: "HEAVY" },
  NotificationType: { Success: "SUCCESS", Warning: "WARNING" },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("haptics — web (no native shell)", () => {
  it("does nothing when not on a native platform", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    await haptics.light();
    await haptics.success();
    expect(Haptics.impact).not.toHaveBeenCalled();
    expect(Haptics.notification).not.toHaveBeenCalled();
  });
});

describe("haptics — native shell", () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  });

  it("triggers an impact for light / medium / heavy", async () => {
    await haptics.light();
    await haptics.medium();
    await haptics.heavy();
    expect(Haptics.impact).toHaveBeenCalledTimes(3);
    const firstImpact = vi.mocked(Haptics.impact).mock.calls[0]?.[0];
    expect(firstImpact?.style).toBe(ImpactStyle.Light);
  });

  it("triggers a notification for success / warning", async () => {
    await haptics.success();
    await haptics.warning();
    expect(Haptics.notification).toHaveBeenCalledTimes(2);
  });

  it("never throws when the native call fails", async () => {
    vi.mocked(Haptics.impact).mockRejectedValueOnce(new Error("no haptics"));
    await expect(haptics.light()).resolves.toBeUndefined();
  });
});
