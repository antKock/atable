import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { POST as postRequest } from "./request/route";
import { POST as postVerify } from "./verify/route";
import { POST as postConsume } from "./consume/route";
import {
  findOwnerByEmail,
  createLoginToken,
  verifyLoginCode,
  createOwnerSession,
  consumeMagicToken,
  executeMergeOwners,
} from "@/lib/queries/recovery";
import { sendRecoveryEmail } from "@/lib/email/send";
import { recoveryIpRateLimit, recoveryEmailRateLimit, recoveryVerifyRateLimit } from "@/lib/redis";
import { resolveSessionOwnerFromCookie } from "@/lib/auth/session-owner";
import { frFull as fr } from "@/lib/i18n/full";

// Tests des trois routes de récupération (#14) — revue 2026-09-12 :
// contrat parseJsonBody (400 illisible / 422 invalide), anti-énumération,
// rate limits, fusion depuis une session source.
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn((fn: () => unknown) => fn()),
}));
vi.mock("@/lib/queries/recovery", () => ({
  findOwnerByEmail: vi.fn(),
  createLoginToken: vi.fn(),
  verifyLoginCode: vi.fn(),
  createOwnerSession: vi.fn(),
  consumeMagicToken: vi.fn(),
  executeMergeOwners: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({ sendRecoveryEmail: vi.fn() }));
vi.mock("@/lib/redis", () => ({
  recoveryIpRateLimit: { limit: vi.fn() },
  recoveryEmailRateLimit: { limit: vi.fn() },
  recoveryVerifyRateLimit: { limit: vi.fn() },
}));
vi.mock("@/lib/auth/session-owner", () => ({ resolveSessionOwnerFromCookie: vi.fn() }));

const mockHeaders = headers as unknown as Mock;

function req(path: string, body: unknown, raw = false): NextRequest {
  return new NextRequest(`https://test.local/api/recovery/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHeaders.mockResolvedValue(new Headers({ "x-forwarded-for": "1.2.3.4", "user-agent": "Mozilla/5.0" }));
  for (const l of [recoveryIpRateLimit, recoveryEmailRateLimit, recoveryVerifyRateLimit]) {
    vi.mocked(l.limit).mockResolvedValue({ success: true } as never);
  }
  vi.mocked(resolveSessionOwnerFromCookie).mockResolvedValue(null);
});

describe("POST /api/recovery/request", () => {
  it("email connu : token créé, email envoyé après la réponse, 200", async () => {
    vi.mocked(findOwnerByEmail).mockResolvedValue({ id: "o-1" });
    vi.mocked(createLoginToken).mockResolvedValue({ token: "tok", code: "123456" } as never);
    const res = await postRequest(req("request", { email: "a@b.fr" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(createLoginToken).toHaveBeenCalledWith("o-1", "recovery");
    expect(sendRecoveryEmail).toHaveBeenCalled();
  });

  it("email inconnu : même 200, rien d'envoyé (anti-énumération)", async () => {
    vi.mocked(findOwnerByEmail).mockResolvedValue(null);
    const res = await postRequest(req("request", { email: "nobody@b.fr" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sendRecoveryEmail).not.toHaveBeenCalled();
  });

  it("échec DB sur le chemin email connu : toujours 200 (pas d'oracle)", async () => {
    vi.mocked(findOwnerByEmail).mockRejectedValue(new Error("db down"));
    expect((await postRequest(req("request", { email: "a@b.fr" }))).status).toBe(200);
  });

  it("format d'email invalide → 422, corps illisible → 400, sans toucher la base", async () => {
    expect((await postRequest(req("request", { email: "pas-un-email" }))).status).toBe(422);
    expect((await postRequest(req("request", "{oops", true))).status).toBe(400);
    expect(findOwnerByEmail).not.toHaveBeenCalled();
  });

  it("429 par IP puis par adresse (que l'email existe ou non)", async () => {
    vi.mocked(recoveryIpRateLimit.limit).mockResolvedValueOnce({ success: false } as never);
    expect((await postRequest(req("request", { email: "a@b.fr" }))).status).toBe(429);
    vi.mocked(recoveryEmailRateLimit.limit).mockResolvedValueOnce({ success: false } as never);
    expect((await postRequest(req("request", { email: "a@b.fr" }))).status).toBe(429);
    expect(findOwnerByEmail).not.toHaveBeenCalled();
  });

  it("refuse (413) un corps annoncé trop gros", async () => {
    const r = new NextRequest("https://test.local/api/recovery/request", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(2 * 1024 * 1024) },
    });
    expect((await postRequest(r)).status).toBe(413);
  });
});

describe("POST /api/recovery/verify", () => {
  it("code valide : nouvelle session + cookie, redirect /home", async () => {
    vi.mocked(findOwnerByEmail).mockResolvedValue({ id: "o-1" });
    vi.mocked(verifyLoginCode).mockResolvedValue(true);
    vi.mocked(createOwnerSession).mockResolvedValue({ sessionId: "sid-9" } as never);
    const res = await postVerify(req("verify", { email: "a@b.fr", code: "123456" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirect: "/home" });
    expect(res.cookies.get("atable_session")?.value).toBeTruthy();
    expect(verifyLoginCode).toHaveBeenCalledWith("o-1", "recovery", "123456");
  });

  it.each([
    ["email inconnu", () => vi.mocked(findOwnerByEmail).mockResolvedValue(null)],
    ["code faux", () => { vi.mocked(findOwnerByEmail).mockResolvedValue({ id: "o-1" }); vi.mocked(verifyLoginCode).mockResolvedValue(false); }],
    ["owner sans foyer", () => { vi.mocked(findOwnerByEmail).mockResolvedValue({ id: "o-1" }); vi.mocked(verifyLoginCode).mockResolvedValue(true); vi.mocked(createOwnerSession).mockResolvedValue(null); }],
  ])("%s → 400 avec le même message générique", async (_label, arrange) => {
    arrange();
    const res = await postVerify(req("verify", { email: "a@b.fr", code: "123456" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(fr.recovery.codeInvalid);
  });

  it("code hors format (5 chiffres) → 422 sans appel DB ; 429 par IP", async () => {
    expect((await postVerify(req("verify", { email: "a@b.fr", code: "12345" }))).status).toBe(422);
    expect(findOwnerByEmail).not.toHaveBeenCalled();
    vi.mocked(recoveryVerifyRateLimit.limit).mockResolvedValueOnce({ success: false } as never);
    expect((await postVerify(req("verify", { email: "a@b.fr", code: "123456" }))).status).toBe(429);
  });
});

describe("POST /api/recovery/consume", () => {
  const TOKEN = "AbCdEfGh23456789";

  it("purpose recovery : session sur l'owner du token, redirect /home", async () => {
    vi.mocked(consumeMagicToken).mockResolvedValue({ ownerId: "o-1", purpose: "recovery" } as never);
    vi.mocked(createOwnerSession).mockResolvedValue({ sessionId: "sid-1" } as never);
    const res = await postConsume(req("consume", { token: TOKEN }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirect: "/home" });
    expect(res.cookies.get("atable_session")?.value).toBeTruthy();
  });

  it("purpose merge avec une session source réelle : fusion, cookie intact, /household", async () => {
    vi.mocked(consumeMagicToken).mockResolvedValue({ ownerId: "o-target", purpose: "merge" } as never);
    vi.mocked(resolveSessionOwnerFromCookie).mockResolvedValue({
      ownerId: "o-source", ownerName: null, ownerAlias: null, recoveryEmail: null, sessionId: "s",
      memberships: [{ householdId: "h", role: "member", isDemo: false }],
    });
    const res = await postConsume(req("consume", { token: TOKEN }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirect: "/household" });
    expect(executeMergeOwners).toHaveBeenCalledWith("o-source", "o-target");
    expect(createOwnerSession).not.toHaveBeenCalled();
    expect(res.cookies.get("atable_session")).toBeUndefined();
  });

  it("purpose merge depuis une session DÉMO : pas de fusion, simple reconnexion à la cible", async () => {
    vi.mocked(consumeMagicToken).mockResolvedValue({ ownerId: "o-target", purpose: "merge" } as never);
    vi.mocked(resolveSessionOwnerFromCookie).mockResolvedValue({
      ownerId: "o-demo", ownerName: null, ownerAlias: null, recoveryEmail: null, sessionId: "s",
      memberships: [{ householdId: "demo", role: "member", isDemo: true }],
    });
    vi.mocked(createOwnerSession).mockResolvedValue({ sessionId: "sid-2" } as never);
    const res = await postConsume(req("consume", { token: TOKEN }));
    expect(executeMergeOwners).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ ok: true, redirect: "/household" });
  });

  it("token brûlé/expiré → 400 ; token hors alphabet → 422 sans appel DB", async () => {
    vi.mocked(consumeMagicToken).mockResolvedValue(null);
    expect((await postConsume(req("consume", { token: TOKEN }))).status).toBe(400);
    expect((await postConsume(req("consume", { token: "0OIl-invalid" }))).status).toBe(422);
    expect(consumeMagicToken).toHaveBeenCalledTimes(1);
  });
});
