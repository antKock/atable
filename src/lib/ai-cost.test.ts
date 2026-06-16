import { describe, it, expect } from "vitest";
import { textCostUsd, imageCostUsd, transcriptionCostUsd } from "./ai-cost";

describe("textCostUsd", () => {
  it("prices gpt-4o input+output (matches observed Bruno billing)", () => {
    // 147,204 in + 36,191 out → $0.368 + $0.362 ≈ $0.730
    expect(textCostUsd("gpt-4o", 147204, 36191)).toBeCloseTo(0.73, 2);
  });

  it("prices gpt-4o-mini cheaply", () => {
    // 104,406 in + 14,979 out → $0.0157 + $0.0090 ≈ $0.02465
    expect(textCostUsd("gpt-4o-mini", 104406, 14979)).toBeCloseTo(0.02465, 4);
  });

  it("treats missing token counts as zero", () => {
    expect(textCostUsd("gpt-4o")).toBe(0);
    expect(textCostUsd("gpt-4o-mini", 1000)).toBeCloseTo(0.00015, 6);
  });

  it("prices unknown models at 0 (fails safe, reconciliation catches it)", () => {
    expect(textCostUsd("gpt-5-ultra", 1000, 1000)).toBe(0);
  });
});

describe("imageCostUsd", () => {
  it("prices low/1024² at the observed flat rate", () => {
    expect(imageCostUsd("low", "1024x1024")).toBe(0.011);
  });

  it("prices higher qualities more", () => {
    expect(imageCostUsd("high", "1024x1024")).toBeGreaterThan(imageCostUsd("low", "1024x1024"));
  });

  it("prices unknown quality/size at 0", () => {
    expect(imageCostUsd("ultra", "4096x4096")).toBe(0);
  });
});

describe("transcriptionCostUsd", () => {
  it("prices whisper at $0.006/min", () => {
    expect(transcriptionCostUsd(60)).toBeCloseTo(0.006, 6);
  });

  it("never goes negative", () => {
    expect(transcriptionCostUsd(-10)).toBe(0);
    expect(transcriptionCostUsd(0)).toBe(0);
  });
});
