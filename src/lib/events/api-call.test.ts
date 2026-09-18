import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  extractErrorCode,
  isTrackedApiPath,
  recordApiCall,
  withApiEvent,
  withApiEventExtra,
} from "./api-call";
import { trackEvent } from "./server";

vi.mock("./server", () => ({ trackEvent: vi.fn() }));
const mockTrack = vi.mocked(trackEvent);

beforeEach(() => mockTrack.mockClear());

const req = (path: string, method = "POST") =>
  new NextRequest(`https://test.local${path}`, { method });

describe("isTrackedApiPath", () => {
  it("exclut heartbeat, journal, version, admin, crons, carrousels", () => {
    for (const p of [
      "/api/activity/ping",
      "/api/events",
      "/api/version",
      "/api/admin/health",
      "/api/cron/demo-reset",
      "/api/carousels",
      "/aasa",
    ]) {
      expect(isTrackedApiPath(p), p).toBe(false);
    }
    expect(isTrackedApiPath("/api/recipes")).toBe(true);
    expect(isTrackedApiPath("/api/households/join")).toBe(true);
  });
  it("exclut les lectures automatiques (polling de statut, tags, bibliothèque, liste) — pas les écritures", () => {
    const id = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";
    expect(isTrackedApiPath(`/api/recipes/${id}/status`, "GET")).toBe(false);
    expect(isTrackedApiPath("/api/tags", "GET")).toBe(false);
    expect(isTrackedApiPath("/api/library", "GET")).toBe(false);
    expect(isTrackedApiPath("/api/recipes", "GET")).toBe(false);
    expect(isTrackedApiPath("/api/recipes", "POST")).toBe(true);
    expect(isTrackedApiPath("/api/tags", "POST")).toBe(true);
    expect(isTrackedApiPath("/api/households/lookup", "GET")).toBe(true);
  });
});

describe("extractErrorCode", () => {
  it("lit `code` d'un corps JSON en erreur, rien en succès", async () => {
    expect(
      await extractErrorCode(
        NextResponse.json({ error: "msg", code: "RATE_LIMIT" }, { status: 429 }),
      ),
    ).toBe("RATE_LIMIT");
    expect(await extractErrorCode(NextResponse.json({ ok: true }))).toBeUndefined();
  });
  it("replie sur `error` s'il est un slug, jamais un message localisé", async () => {
    expect(
      await extractErrorCode(NextResponse.json({ error: "extraction_failed" }, { status: 422 })),
    ).toBe("extraction_failed");
    expect(
      await extractErrorCode(
        NextResponse.json({ error: "Lien invalide, réessaie" }, { status: 400 }),
      ),
    ).toBeUndefined();
  });
  it("laisse le corps lisible après extraction (clone)", async () => {
    const res = NextResponse.json({ error: "x", code: "C" }, { status: 400 });
    await extractErrorCode(res);
    expect(await res.json()).toEqual({ error: "x", code: "C" });
  });
});

describe("recordApiCall", () => {
  it("émet api.called avec motif, statut, durée, code d'erreur et méthode d'import", async () => {
    await recordApiCall({
      request: req("/api/recipes/import/screenshot"),
      response: NextResponse.json({ error: "m", code: "EXTRACTION_FAILED" }, { status: 422 }),
      startedAt: performance.now() - 50,
    });
    expect(mockTrack).toHaveBeenCalledTimes(1);
    const [name, props] = mockTrack.mock.calls[0];
    expect(name).toBe("api.called");
    expect(props).toMatchObject({
      route: "/api/recipes/import/screenshot",
      method: "POST",
      status: 422,
      error_code: "EXTRACTION_FAILED",
      method_kind: "photo",
    });
    expect((props as { duration_ms: number }).duration_ms).toBeGreaterThanOrEqual(40);
  });

  it("porte les identifiants du chemin et de la réponse de création (jamais de contenu)", async () => {
    const id = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";
    await recordApiCall({
      request: req(`/api/recipes/${id}/share`),
      response: NextResponse.json({ ok: true }),
      startedAt: performance.now(),
    });
    expect(mockTrack.mock.calls[0][1]).toMatchObject({
      route: "/api/recipes/[id]/share",
      recipe_id: id,
    });

    mockTrack.mockClear();
    await recordApiCall({
      request: req("/api/recipes"),
      response: NextResponse.json({ id, title: "SECRET" }, { status: 201 }),
      startedAt: performance.now(),
    });
    const props = mockTrack.mock.calls[0][1] as Record<string, unknown>;
    expect(props).toMatchObject({ recipe_id: id, status: 201 });
    expect(JSON.stringify(props)).not.toContain("SECRET");
  });

  it("n'émet rien pour une route exclue", async () => {
    await recordApiCall({
      request: req("/api/activity/ping"),
      response: NextResponse.json({ ok: true }),
      startedAt: performance.now(),
    });
    expect(mockTrack).not.toHaveBeenCalled();
  });
});

describe("withApiEvent", () => {
  it("rend la réponse du handler et émet anonymement", async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const res = await withApiEvent(handler)(req("/api/households/lookup?code=X", "GET"));
    expect(res.status).toBe(200);
    expect(mockTrack.mock.calls[0][1]).toMatchObject({
      route: "/api/households/lookup",
      method: "GET",
    });
    expect(mockTrack.mock.calls[0][2]).toEqual({ owner: undefined });
  });
});

describe("en-tête interne x-mijote-event", () => {
  it("complète l'événement et est retiré de la réponse avant l'envoi", async () => {
    const res = withApiEventExtra(NextResponse.json({ id: "x" }, { status: 201 }), {
      method_kind: "manual",
    });
    await recordApiCall({
      request: req("/api/recipes"),
      response: res,
      startedAt: performance.now(),
    });
    expect(mockTrack.mock.calls[0][1]).toMatchObject({ method_kind: "manual" });
    expect(res.headers.get("x-mijote-event")).toBeNull();
  });

  it("import photo : la nature des images rejoint method_kind", async () => {
    const res = withApiEventExtra(NextResponse.json({ title: "x" }), {
      image_kind: "printed_photo",
    });
    await recordApiCall({
      request: req("/api/recipes/import/screenshot"),
      response: res,
      startedAt: performance.now(),
    });
    expect(mockTrack.mock.calls[0][1]).toMatchObject({
      method_kind: "photo",
      image_kind: "printed_photo",
    });
  });
});
