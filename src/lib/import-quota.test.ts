import { describe, it, expect, vi, beforeEach } from "vitest";
import { enforceImportQuota } from "./import-quota";
import { importRateLimit } from "@/lib/redis";

vi.mock("@/lib/redis", () => ({
  importRateLimit: { limit: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(importRateLimit.limit).mockReset();
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
