import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichStaleRecipes } from "./stale";
import { enrichRecipe } from "@/lib/enrichment";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/enrichment", () => ({ enrichRecipe: vi.fn() }));

let supa: SupabaseMock;
beforeEach(() => {
  vi.clearAllMocks();
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
});

describe("enrichStaleRecipes", () => {
  it("sélectionne les `pending` plus vieilles que 1 h, 20 max, plus anciennes d'abord, et les rejoue", async () => {
    supa.queueResult({ data: [{ id: "r1" }, { id: "r2" }] });
    const now = new Date("2026-09-13T12:00:00Z");
    const summary = await enrichStaleRecipes(now);
    const ops = supa.calls[0].ops;
    expect(ops.find((o) => o.method === "eq")!.args).toEqual(["enrichment_status", "pending"]);
    expect(ops.find((o) => o.method === "lt")!.args).toEqual([
      "updated_at",
      "2026-09-13T11:00:00.000Z",
    ]);
    expect(ops.find((o) => o.method === "limit")!.args).toEqual([20]);
    expect(ops.find((o) => o.method === "order")!.args).toEqual([
      "updated_at",
      { ascending: true },
    ]);
    expect(vi.mocked(enrichRecipe).mock.calls.map(([id]) => id)).toEqual(["r1", "r2"]);
    expect(summary).toEqual({
      scanned: 2,
      results: [
        { id: "r1", status: "ok" },
        { id: "r2", status: "ok" },
      ],
    });
  });

  it("une recette en erreur n'arrête pas le passage", async () => {
    supa.queueResult({ data: [{ id: "r1" }, { id: "r2" }] });
    vi.mocked(enrichRecipe).mockRejectedValueOnce(new Error("boom"));
    const summary = await enrichStaleRecipes();
    expect(summary.results).toEqual([
      { id: "r1", status: "error" },
      { id: "r2", status: "ok" },
    ]);
  });

  it("rien à faire → scanned 0 ; erreur de lecture → levée", async () => {
    supa.queueResult({ data: [] });
    expect((await enrichStaleRecipes()).scanned).toBe(0);
    supa.queueResult({ data: null, error: { message: "db down" } });
    await expect(enrichStaleRecipes()).rejects.toThrow("db down");
  });
});
