import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createSupabaseMock, findCall, type SupabaseMock } from "@/test/supabase-mock";
import type { OwnerContext } from "@/lib/auth/owner-context";
import type { PoolStore } from "./store";
import { PROBE_INTERNAL_HEADER } from "@/lib/probe";

// Conservation 30 jours des envois d'import (docs/specs/ocr-appareil/01-conservation-imports.md).

const pending: Promise<unknown>[] = [];
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn((fn: () => Promise<unknown>) => pending.push(fn())) };
});
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

let db: SupabaseMock;
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => db.client }));

const store: { [K in keyof PoolStore]: ReturnType<typeof vi.fn> } = {
  put: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  get: vi.fn(async () => new Uint8Array()),
};
vi.mock("./store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store")>();
  return { ...actual, getPoolStore: () => store };
});

const {
  keepImportSample,
  importPoolState,
  deleteOwnerImportSamples,
  purgeExpiredImportSamples,
  POOL_DAILY_CAP,
} = await import("./samples");

const OWNER: OwnerContext = {
  ownerId: "owner-1",
  ownerName: null,
  ownerAlias: null,
  recoveryEmail: null,
  sessionId: "session-1",
  isProbe: false,
  importPoolOptOut: false,
  memberships: [{ householdId: "hh-1", role: "member", isDemo: false }],
};

const RECIPE = { title: "Tarte", ingredients: "pommes", steps: "cuire" };
const photo = { name: "1.jpg", body: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" };

function keep(
  response: NextResponse,
  extra: Partial<Parameters<typeof keepImportSample>[0]> = {},
): Promise<NextResponse> {
  return keepImportSample({
    owner: OWNER,
    householdId: "hh-1",
    method: "photo",
    response,
    files: async () => [photo],
    ...extra,
  });
}

async function flush() {
  await Promise.all(pending.splice(0));
}

beforeEach(() => {
  db = createSupabaseMock();
  vi.clearAllMocks();
  pending.length = 0;
  vi.stubEnv("IMPORT_POOL_ENABLED", "1");
  vi.stubEnv("ADMIN_HOUSEHOLD_IDS", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("keepImportSample — qui et quoi", () => {
  it("import réussi : `sampleId` dans la réponse, `sample_id` au journal, ligne puis fichiers", async () => {
    db.queueResults([{ count: 0 }, { error: null }]);
    const res = await keep(NextResponse.json(RECIPE));
    const body = await res.json();
    expect(body).toMatchObject(RECIPE);
    expect(body.sampleId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(res.headers.get("x-mijote-event")!)).toEqual({ sample_id: body.sampleId });

    await flush();
    const insert = findCall(db, "import_samples")!.ops;
    expect(db.calls.map((c) => c.table)).toEqual(["import_samples", "import_samples"]);
    const row = db.calls[1].ops.find((o) => o.method === "insert")!.args[0] as Record<
      string,
      unknown
    >;
    expect(insert.some((o) => o.method === "select")).toBe(true); // plafond vérifié
    expect(row).toMatchObject({
      id: body.sampleId,
      owner_id: "owner-1",
      household_id: "hh-1",
      method: "photo",
      status: 200,
      error_code: null,
      files: [`${body.sampleId}/1.jpg`],
      extracted: RECIPE,
    });
    expect(store.put).toHaveBeenCalledWith(`${body.sampleId}/1.jpg`, photo.body, "image/jpeg");
  });

  it("import en échec : gardé (c'est ce qu'on veut reproduire), sans plafond ni sampleId client", async () => {
    db.queueResults([{ error: null }]);
    const failed = NextResponse.json({ error: "x", code: "EXTRACTION_FAILED" }, { status: 422 });
    const res = await keep(failed);
    expect(await res.json()).toEqual({ error: "x", code: "EXTRACTION_FAILED" });
    const sampleId = JSON.parse(res.headers.get("x-mijote-event")!).sample_id;

    await flush();
    expect(db.calls).toHaveLength(1); // pas de comptage : les échecs passent toujours
    const row = db.calls[0].ops.find((o) => o.method === "insert")!.args[0];
    expect(row).toMatchObject({
      id: sampleId,
      status: 422,
      error_code: "EXTRACTION_FAILED",
      extracted: null,
    });
  });

  it("lien : l'adresse, la voie et le texte passé au modèle (page.txt)", async () => {
    db.queueResults([{ count: 0 }, { error: null }]);
    const res = await keep(NextResponse.json(RECIPE), {
      method: "url",
      url: "https://example.com/r",
      trace: { text: "texte de la page", path: "import_url", model: "gpt-5.6-luna" },
      files: async () => [],
    });
    const { sampleId } = await res.json();
    await flush();
    const row = db.calls[1].ops.find((o) => o.method === "insert")!.args[0];
    expect(row).toMatchObject({
      method: "url",
      url: "https://example.com/r",
      path: "import_url",
      model: "gpt-5.6-luna",
      files: [`${sampleId}/page.txt`],
    });
    expect(store.put).toHaveBeenCalledWith(
      `${sampleId}/page.txt`,
      new TextEncoder().encode("texte de la page"),
      "text/plain; charset=utf-8",
    );
  });

  it("plafond atteint : l'import réussi n'est pas gardé", async () => {
    db.queueResults([{ count: POOL_DAILY_CAP }]);
    await keep(NextResponse.json(RECIPE));
    await flush();
    expect(db.calls).toHaveLength(1);
    expect(store.put).not.toHaveBeenCalled();
  });

  it("un échec du stockage ne fait jamais échouer l'import", async () => {
    db.queueResults([{ count: 0 }, { error: null }]);
    store.put.mockRejectedValueOnce(new Error("s3 down"));
    const res = await keep(NextResponse.json(RECIPE));
    expect(res.status).toBe(200);
    await expect(flush()).resolves.toBeUndefined();
    const Sentry = await import("@sentry/nextjs");
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it.each([
    ["flag éteint", () => vi.stubEnv("IMPORT_POOL_ENABLED", "0"), OWNER],
    ["refus", () => {}, { ...OWNER, importPoolOptOut: true }],
    [
      "démo",
      () => {},
      { ...OWNER, memberships: [{ householdId: "d", role: "member" as const, isDemo: true }] },
    ],
    ["owner sonde", () => {}, { ...OWNER, isProbe: true }],
    ["admin", () => vi.stubEnv("ADMIN_HOUSEHOLD_IDS", "hh-1"), OWNER],
  ])("%s : rien n'est gardé, réponse inchangée", async (_label, setup, owner) => {
    setup();
    const response = NextResponse.json(RECIPE);
    const res = await keepImportSample({
      owner,
      householdId: "hh-1",
      method: "photo",
      response,
      files: async () => [photo],
    });
    expect(res).toBe(response);
    await flush();
    expect(db.calls).toHaveLength(0);
  });

  it("requête sonde (#26, en-tête interne posé par le proxy) : rien n'est gardé", async () => {
    vi.mocked(headers).mockResolvedValueOnce(
      new Headers({ [PROBE_INTERNAL_HEADER]: "1" }) as never,
    );
    const response = NextResponse.json(RECIPE);
    expect(await keep(response)).toBe(response);
    await flush();
    expect(db.calls).toHaveLength(0);
  });

  it.each([
    [400, "INVALID_DATA"],
    [429, "IMPORT_QUOTA"],
  ])("%i %s : rien n'a été traité, rien n'est gardé", async (status, code) => {
    const response = NextResponse.json({ error: "x", code }, { status });
    expect(await keep(response)).toBe(response);
    await flush();
    expect(db.calls).toHaveLength(0);
  });
});

describe("importPoolState", () => {
  it("allumé pour une personne ordinaire, éteint pour la démo, refus reflété", () => {
    expect(importPoolState(OWNER)).toEqual({ enabled: true, optedOut: false });
    expect(importPoolState({ ...OWNER, importPoolOptOut: true })).toEqual({
      enabled: true,
      optedOut: true,
    });
    expect(
      importPoolState({
        ...OWNER,
        memberships: [{ householdId: "d", role: "member", isDemo: true }],
      }).enabled,
    ).toBe(false);
  });
});

describe("suppression", () => {
  it("refus : les fichiers puis les lignes de la personne", async () => {
    db.queueResults([
      {
        data: [
          { id: "s1", files: ["s1/1.jpg", "s1/2.jpg"] },
          { id: "s2", files: ["s2/audio.webm"] },
        ],
      },
      { error: null },
    ]);
    expect(await deleteOwnerImportSamples("owner-1")).toBe(2);
    expect(store.remove).toHaveBeenCalledWith(["s1/1.jpg", "s1/2.jpg", "s2/audio.webm"]);
    expect(db.calls[0].ops).toContainEqual({ method: "eq", args: ["owner_id", "owner-1"] });
    expect(db.calls[1].ops).toContainEqual({ method: "in", args: ["id", ["s1", "s2"]] });
  });

  it("purge nocturne : expirés et orphelins, puis restes d'un refus", async () => {
    const now = new Date("2026-10-20T03:00:00Z");
    db.queueResults([
      { data: [{ id: "old", files: ["old/1.jpg"] }] },
      { error: null },
      { data: [{ owner_id: "owner-2" }, { owner_id: "owner-2" }] },
      { data: [{ id: "left", files: ["left/audio.m4a"] }] },
      { error: null },
    ]);
    expect(await purgeExpiredImportSamples(now)).toBe(2);
    expect(db.calls[0].ops).toContainEqual({
      method: "or",
      args: ["expires_at.lt.2026-10-20T03:00:00.000Z,owner_id.is.null"],
    });
    expect(db.calls[3].ops).toContainEqual({ method: "eq", args: ["owner_id", "owner-2"] });
    expect(store.remove).toHaveBeenCalledWith(["old/1.jpg"]);
    expect(store.remove).toHaveBeenCalledWith(["left/audio.m4a"]);
  });
});
