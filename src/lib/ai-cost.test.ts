import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@/lib/supabase/server";
import { textCostUsd, imageCostUsd, transcriptionCostUsd, recordAiCost } from "./ai-cost";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/supabase/server");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

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

describe("recordAiCost", () => {
  // Contexte : Sentry JAVASCRIPT-NEXTJS-B (2026-08-30) — l'enrichissement
  // tourne dans after(), la recette est supprimée avant la fin de la
  // génération d'image, l'insert ai_costs viole la FK recipe_id.
  it("retente sans recipe_id quand la recette a été supprimée entre-temps (FK 23503)", async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: "23503", message: "violates foreign key constraint" } })
      .mockResolvedValueOnce({ error: null });
    vi.mocked(createServerClient).mockReturnValue({
      from: () => ({ insert }),
    } as unknown as ReturnType<typeof createServerClient>);

    await recordAiCost({ householdId: "h1", recipeId: "r-gone", callType: "image", model: "m", costUsd: 0.011 });

    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0][0]).toMatchObject({ recipe_id: "r-gone" });
    expect(insert.mock.calls[1][0]).toMatchObject({ recipe_id: null, household_id: "h1", cost_usd: 0.011 });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("remonte à Sentry les autres erreurs sans jamais throw", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: "42P01", message: "relation missing" } });
    vi.mocked(createServerClient).mockReturnValue({
      from: () => ({ insert }),
    } as unknown as ReturnType<typeof createServerClient>);

    await expect(recordAiCost({ householdId: "h1", callType: "ocr", model: "m", costUsd: 0 })).resolves.toBeUndefined();

    expect(insert).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledOnce();
  });
});
