import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enforceImportQuota,
  enforceRecipeCreateQuota,
  enforceHouseholdCreateQuota,
} from "./import-quota";
import {
  importRateLimit,
  recipeCreateRateLimit,
  householdCreateRateLimit,
} from "@/lib/redis";

vi.mock("@/lib/redis", () => ({
  importRateLimit: { limit: vi.fn() },
  recipeCreateRateLimit: { limit: vi.fn() },
  householdCreateRateLimit: { limit: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(importRateLimit.limit).mockReset();
  vi.mocked(recipeCreateRateLimit.limit).mockReset();
  vi.mocked(householdCreateRateLimit.limit).mockReset();
});

describe("enforceImportQuota", () => {
  it("returns null when the household is under quota", async () => {
    vi.mocked(importRateLimit.limit).mockResolvedValue({ success: true } as never);
    const res = await enforceImportQuota("hh-1");
    expect(res).toBeNull();
    expect(importRateLimit.limit).toHaveBeenCalledWith("hh-1");
  });

  it("returns a 429 with the IMPORT_QUOTA code when exhausted", async () => {
    vi.mocked(importRateLimit.limit).mockResolvedValue({ success: false } as never);
    const res = await enforceImportQuota("hh-1");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    const body = await res!.json();
    expect(body.code).toBe("IMPORT_QUOTA");
  });

  it("fails open when Redis is unreachable", async () => {
    vi.mocked(importRateLimit.limit).mockRejectedValue(new Error("redis down"));
    const res = await enforceImportQuota("hh-1");
    expect(res).toBeNull();
  });
});

describe("enforceRecipeCreateQuota", () => {
  it("returns null when the household is under quota", async () => {
    vi.mocked(recipeCreateRateLimit.limit).mockResolvedValue({ success: true } as never);
    const res = await enforceRecipeCreateQuota("hh-1");
    expect(res).toBeNull();
    expect(recipeCreateRateLimit.limit).toHaveBeenCalledWith("hh-1");
  });

  it("returns a 429 with the RECIPE_QUOTA code when exhausted", async () => {
    vi.mocked(recipeCreateRateLimit.limit).mockResolvedValue({ success: false } as never);
    const res = await enforceRecipeCreateQuota("hh-1");
    expect(res!.status).toBe(429);
    const body = await res!.json();
    expect(body.code).toBe("RECIPE_QUOTA");
  });

  it("fails open when Redis is unreachable", async () => {
    vi.mocked(recipeCreateRateLimit.limit).mockRejectedValue(new Error("redis down"));
    const res = await enforceRecipeCreateQuota("hh-1");
    expect(res).toBeNull();
  });
});

describe("enforceHouseholdCreateQuota", () => {
  it("returns null when the IP is under quota", async () => {
    vi.mocked(householdCreateRateLimit.limit).mockResolvedValue({ success: true } as never);
    const res = await enforceHouseholdCreateQuota("1.2.3.4");
    expect(res).toBeNull();
    expect(householdCreateRateLimit.limit).toHaveBeenCalledWith("1.2.3.4");
  });

  it("returns a 429 with the HOUSEHOLD_QUOTA code when exhausted", async () => {
    vi.mocked(householdCreateRateLimit.limit).mockResolvedValue({ success: false } as never);
    const res = await enforceHouseholdCreateQuota("1.2.3.4");
    expect(res!.status).toBe(429);
    const body = await res!.json();
    expect(body.code).toBe("HOUSEHOLD_QUOTA");
  });

  it("fails open when Redis is unreachable", async () => {
    vi.mocked(householdCreateRateLimit.limit).mockRejectedValue(new Error("redis down"));
    const res = await enforceHouseholdCreateQuota("1.2.3.4");
    expect(res).toBeNull();
  });
});
