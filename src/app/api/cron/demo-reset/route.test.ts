import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import * as Sentry from "@sentry/nextjs";

vi.mock("@/lib/supabase/server");

// withMonitor exécute le callback (pas de check-in en test) mais consigne
// l'issue, comme le ferait Sentry : `ok` si le callback rend, `error` s'il jette.
const monitor = vi.hoisted(() => ({ status: null as null | "ok" | "error" }));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withMonitor: async (_name: string, fn: () => unknown) => {
    try {
      const out = await fn();
      monitor.status = "ok";
      return out;
    } catch (err) {
      monitor.status = "error";
      throw err;
    }
  },
}));

let supa: SupabaseMock;

const ENV_KEYS = ["CRON_SECRET", "DEMO_SEED_MIN", "DEMO_HOUSEHOLD_ID_EN"] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  vi.mocked(Sentry.captureException).mockClear();
  monitor.status = null;
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.restoreAllMocks();
});

// Step 1b (incident 2026-09) : après la purge des non-seed, le cron compte
// les seed restantes — un résultat de plus à queuer dans chaque scénario.
const SEED_OK = { count: 30, error: null };
// Step 1c : purge des tags démo (résultat consommé après le comptage seed).
const TAGS_NONE = { count: 0, error: null };

const DEMO_FR = "00000000-0000-0000-0000-000000000000";
const DEMO_EN = "11111111-1111-1111-1111-111111111111";

function request(auth?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = auth;
  return new NextRequest("https://test.local/api/cron/demo-reset", { headers });
}

function alertCalls() {
  return vi
    .mocked(Sentry.captureException)
    .mock.calls.filter(([err]) => err instanceof Error && err.message.includes("démo amputée"));
}

describe("GET /api/cron/demo-reset — authentification", () => {
  it("exposes a GET handler (the VPS crontab calls GET, not POST)", () => {
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

  it("401 sur un token de même longueur mais différent (comparaison en temps constant)", async () => {
    const res = await GET(request("Bearer test-cron-secreX"));
    expect(res.status).toBe(401);
  });

  it("401 systématique quand CRON_SECRET est absent — même avec « Bearer undefined »", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(request("Bearer undefined"))).status).toBe(401);
    expect((await GET(request("Bearer "))).status).toBe(401);
    expect((await GET(request())).status).toBe(401);
    expect(supa.calls).toHaveLength(0);
  });

  it("401 quand CRON_SECRET est vide", async () => {
    process.env.CRON_SECRET = "";
    expect((await GET(request("Bearer "))).status).toBe(401);
  });
});

describe("GET /api/cron/demo-reset (Fix 1.5)", () => {
  it("resets the demo household with the correct token", async () => {
    supa.queueResults([
      { data: null, error: null }, // rpc demo_stats_rollup (Step 0)
      { count: 3, error: null }, // delete recettes non-seed
      SEED_OK,
      { count: 2, error: null }, // purge tags démo
    ]);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      reset: true,
      deleted: 3,
      seedCount: 30,
      restored: 0,
      purgedTags: 2,
      purgedOwners: 0,
      purgedTokens: 0,
    });
    expect(monitor.status).toBe("ok");
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

  it("purge les tags custom des foyers démo (monde gelé) — recipe_tags suit en cascade", async () => {
    supa.queueResults([
      { data: null, error: null },
      { count: 0, error: null },
      SEED_OK,
      { count: 4, error: null }, // purge tags démo
    ]);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(await res.json()).toMatchObject({ purgedTags: 4 });
    const tagsCall = supa.calls.find((c) => c.table === "tags")!;
    expect(tagsCall.ops.some((op) => op.method === "delete")).toBe(true);
    expect(
      tagsCall.ops.some(
        (op) =>
          op.method === "in" &&
          op.args[0] === "household_id" &&
          JSON.stringify(op.args[1]) === JSON.stringify([DEMO_FR]),
      ),
    ).toBe(true);
  });

  it("un échec de la purge des tags n'empêche pas le reset (best-effort)", async () => {
    supa.queueResults([
      { data: null, error: null },
      { count: 0, error: null },
      SEED_OK,
      { count: null, error: { message: "tags failed" } },
    ]);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ purgedTags: 0 });
  });

  it("purge les owners démo périmés, sauf ceux ayant un membership hors démo", async () => {
    supa.queueResults([
      { data: null, error: null }, // rpc demo_stats_rollup (Step 0)
      { count: 0, error: null }, // delete recettes non-seed
      SEED_OK,
      TAGS_NONE,
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
      TAGS_NONE,
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

  it("returns 500 when the delete fails — et le moniteur Sentry passe en erreur", async () => {
    supa.queueResults([
      { data: null, error: null }, // rpc demo_stats_rollup (Step 0)
      { count: null, error: { message: "db error" } },
    ]);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(500);
    expect(monitor.status).toBe("error");
    expect(
      vi.mocked(Sentry.captureException).mock.calls.some(
        ([err]) => err instanceof Error && err.message.includes("delete failed: db error"),
      ),
    ).toBe(true);
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
    const call = alertCalls()[0];
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
    expect(alertCalls()).toHaveLength(0);
  });

  it("DEMO_SEED_MIN illisible → seuil 30 + warn (une valeur NaN désactiverait l'alerte)", async () => {
    process.env.DEMO_SEED_MIN = "abc";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    supa.queueResults([
      { data: null, error: null },
      { count: 0, error: null },
      { count: 29, error: null }, // 29 < 30 → alerte attendue
    ]);
    await GET(request("Bearer test-cron-secret"));
    expect(alertCalls()).toHaveLength(1);
    expect(alertCalls()[0][0]).toMatchObject({ message: expect.stringContaining("< 30 attendues") });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("DEMO_SEED_MIN invalide"));
  });

  it("DEMO_SEED_MIN ≤ 0 → seuil 30", async () => {
    process.env.DEMO_SEED_MIN = "0";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    supa.queueResults([
      { data: null, error: null },
      { count: 0, error: null },
      { count: 5, error: null },
    ]);
    await GET(request("Bearer test-cron-secret"));
    expect(alertCalls()).toHaveLength(1);
  });

  it("DEMO_SEED_MIN explicite est respecté", async () => {
    process.env.DEMO_SEED_MIN = "10";
    supa.queueResults([
      { data: null, error: null },
      { count: 0, error: null },
      { count: 12, error: null }, // 12 ≥ 10 → pas d'alerte
    ]);
    await GET(request("Bearer test-cron-secret"));
    expect(alertCalls()).toHaveLength(0);
  });

  it("appelle le rollup UNE fois avec le tableau des foyers démo (migration 038)", async () => {
    supa.queueResults([
      { data: null, error: null },
      { count: 0, error: null },
      SEED_OK,
    ]);
    await GET(request("Bearer test-cron-secret"));
    const rollups = supa.calls.filter((c) => c.table === "rpc:demo_stats_rollup");
    expect(rollups).toHaveLength(1);
    const args = rollups[0].ops[0]?.args?.[0] as { p_demo_households?: string[] } | undefined;
    expect(Array.isArray(args?.p_demo_households)).toBe(true);
    expect(args?.p_demo_households).toContain(DEMO_FR);
  });
});

describe("GET /api/cron/demo-reset — deux foyers démo (Version EN)", () => {
  it("EN absent → un seul foyer traité (un seul comptage seed)", async () => {
    delete process.env.DEMO_HOUSEHOLD_ID_EN;
    supa.queueResults([
      { data: null, error: null },
      { count: 0, error: null },
      SEED_OK,
    ]);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(await res.json()).toMatchObject({ seedCount: 30 });
    const seedCounts = supa.calls.filter(
      (c) => c.table === "recipes" && c.ops.some((op) => op.method === "select"),
    );
    expect(seedCounts).toHaveLength(1);
    const rollupArgs = supa.calls.find((c) => c.table === "rpc:demo_stats_rollup")!.ops[0]
      .args[0] as { p_demo_households: string[] };
    expect(rollupArgs.p_demo_households).toEqual([DEMO_FR]);
  });

  it("EN posé et sous le seuil → alerte pour le foyer EN seulement, seedCount cumulé", async () => {
    process.env.DEMO_HOUSEHOLD_ID_EN = DEMO_EN;
    vi.spyOn(console, "error").mockImplementation(() => {});
    supa.queueResults([
      { data: null, error: null }, // rollup (les deux foyers)
      { count: 1, error: null }, // delete non-seed (les deux foyers)
      { count: 30, error: null }, // seed FR
      { count: 7, error: null }, // seed EN < 30
      TAGS_NONE,
    ]);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ seedCount: 37, deleted: 1 });

    const alerts = alertCalls();
    expect(alerts).toHaveLength(1);
    expect((alerts[0][0] as Error).message).toContain(DEMO_EN);
    expect((alerts[0][0] as Error).message).not.toContain(`(${DEMO_FR})`);

    // Purges (recettes, tags, owners) ciblent bien les deux foyers.
    const recipesDelete = supa.calls.find(
      (c) => c.table === "recipes" && c.ops.some((op) => op.method === "delete"),
    )!;
    expect(
      recipesDelete.ops.some(
        (op) => op.method === "in" && JSON.stringify(op.args[1]) === JSON.stringify([DEMO_FR, DEMO_EN]),
      ),
    ).toBe(true);
    const tagsDelete = supa.calls.find((c) => c.table === "tags")!;
    expect(
      tagsDelete.ops.some(
        (op) => op.method === "in" && JSON.stringify(op.args[1]) === JSON.stringify([DEMO_FR, DEMO_EN]),
      ),
    ).toBe(true);
  });
});
