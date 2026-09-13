import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { enrichStaleRecipes } from "@/lib/enrichment/stale";

vi.mock("@/lib/enrichment/stale", () => ({ enrichStaleRecipes: vi.fn() }));

const req = (auth?: string) =>
  new NextRequest("https://test.local/api/cron/enrich-stale", {
    headers: auth ? { authorization: auth } : {},
  });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/cron/enrich-stale", () => {
  it("401 sans le secret cron, sans rien relancer", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(enrichStaleRecipes).not.toHaveBeenCalled();
  });

  it("renvoie le résumé du passage", async () => {
    vi.mocked(enrichStaleRecipes).mockResolvedValue({
      scanned: 1,
      results: [{ id: "r1", status: "ok" }],
    });
    const res = await GET(req(`Bearer ${process.env.CRON_SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ scanned: 1, results: [{ id: "r1", status: "ok" }] });
  });

  it("500 générique si la lecture échoue", async () => {
    vi.mocked(enrichStaleRecipes).mockRejectedValue(new Error("db down"));
    expect((await GET(req(`Bearer ${process.env.CRON_SECRET}`))).status).toBe(500);
  });
});
