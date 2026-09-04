import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import * as Sentry from "@sentry/nextjs";

vi.mock("@/lib/supabase/server");
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  vi.mocked(Sentry.captureException).mockClear();
});

// Step 1b (incident 2026-09) : après la purge des non-seed, le cron compte
// les seed restantes — un résultat de plus à queuer dans chaque scénario.
const SEED_OK = { count: 30, error: null };

function request(auth?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = auth;
  return new NextRequest("https://test.local/api/cron/demo-reset", { headers });
}

describe("GET /api/cron/demo-reset (Fix 1.5)", () => {
  it("exposes a GET handler (Vercel Cron sends GET, not POST)", () => {
    expect(typeof GET).toBe("function");
  });

  it("returns 401 with no authorization header", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it("returns 401 with a wrong bearer token", async () => {
    const res = await GET(request("Bearer wrong-token"));
    expect(res.status).toBe(401);
  });

  it("resets the demo household with the correct token", async () => {
    supa.queueResults([
      { data: null, error: null }, // rpc demo_stats_rollup (Step 0)
      { count: 3, error: null }, // delete recettes non-seed
      SEED_OK,
    ]);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      reset: true,
      deleted: 3,
      seedCount: 30,
      restored: 0,
      purgedOwners: 0,
      purgedTokens: 0,
    });
  });

  it("consolide les stats démo (rollup 032) AVANT la purge des recettes", async () => {
    supa.queueResults([
      { data: null, error: null }, // rpc demo_stats_rollup
      { count: 0, error: null }, // delete recettes
      SEED_OK,
    ]);
    await GET(request("Bearer test-cron-secret"));
    const rollupIdx = supa.calls.findIndex((c) => c.table === "rpc:demo_stats_rollup");
    const deleteIdx = supa.calls.findIndex((c) => c.table === "recipes");
    expect(rollupIdx).toBeGreaterThanOrEqual(0);
    expect(deleteIdx).toBeGreaterThan(rollupIdx);
  });

  it("un échec du rollup n'empêche pas le reset (best-effort)", async () => {
    supa.queueResults([
      { data: null, error: { message: "rollup failed" } }, // rpc demo_stats_rollup
      { count: 2, error: null }, // delete recettes
      SEED_OK,
    ]);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ reset: true, deleted: 2 });
  });

  it("purge les owners démo périmés, sauf ceux ayant un membership hors démo", async () => {
    supa.queueResults([
      { data: null, error: null }, // rpc demo_stats_rollup (Step 0)
      { count: 0, error: null }, // delete recettes non-seed
      SEED_OK,
      { data: [{ owner_id: "owner-old" }, { owner_id: "owner-multi" }], error: null }, // candidats périmés
      { data: [{ owner_id: "owner-multi" }], error: null }, // garde-fou : membership hors démo
      { count: 1, error: null }, // delete owners
    ]);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ purgedOwners: 1 });

    const ownersDelete = supa.calls.find(
      (c) => c.table === "owners" && c.ops.some((op) => op.method === "delete"),
    )!;
    expect(
      ownersDelete.ops.some(
        (op) =>
          op.method === "in" &&
          op.args[0] === "id" &&
          JSON.stringify(op.args[1]) === JSON.stringify(["owner-old"]),
      ),
    ).toBe(true);
  });

  it("ne touche pas aux owners quand aucun candidat n'est périmé", async () => {
    supa.queueResults([
      { data: null, error: null }, // rpc demo_stats_rollup (Step 0)
      { count: 0, error: null },
      SEED_OK,
      { data: [], error: null },
    ]);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ purgedOwners: 0 });
    expect(supa.calls.some((c) => c.table === "owners")).toBe(false);
  });

  it("deletes only is_seed=false rows", async () => {
    supa.queueResults([
      { data: null, error: null }, // rpc demo_stats_rollup (Step 0)
      { count: 0, error: null },
      SEED_OK,
    ]);
    await GET(request("Bearer test-cron-secret"));
    const recipesCall = supa.calls.find((c) => c.table === "recipes")!;
    expect(recipesCall.ops.some((op) => op.method === "delete")).toBe(true);
    expect(
      recipesCall.ops.some(
        (op) =>
          op.method === "eq" && op.args[0] === "is_seed" && op.args[1] === false,
      ),
    ).toBe(true);
  });

  it("returns 500 when the delete fails", async () => {
    supa.queueResults([
      { data: null, error: null }, // rpc demo_stats_rollup (Step 0)
      { count: null, error: { message: "db error" } },
    ]);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(500);
  });

  it("alerte Sentry (fatal) quand les recettes seed passent sous le seuil — incident 2026-09", async () => {
    supa.queueResults([
      { data: null, error: null }, // rpc demo_stats_rollup (Step 0)
      { count: 0, error: null }, // delete recettes non-seed
      { count: 12, error: null }, // seed restantes < 30
    ]);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ seedCount: 12 });
    const call = vi.mocked(Sentry.captureException).mock.calls.find(
      ([err]) => err instanceof Error && err.message.includes("démo amputée"),
    );
    expect(call).toBeTruthy();
    expect(call?.[1]).toMatchObject({ level: "fatal" });
  });

  it("pas d'alerte quand les 30 seed sont là", async () => {
    supa.queueResults([
      { data: null, error: null },
      { count: 0, error: null },
      SEED_OK,
    ]);
    await GET(request("Bearer test-cron-secret"));
    expect(
      vi.mocked(Sentry.captureException).mock.calls.some(
        ([err]) => err instanceof Error && err.message.includes("démo amputée"),
      ),
    ).toBe(false);
  });
});
