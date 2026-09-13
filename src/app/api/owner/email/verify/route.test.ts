import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getOwnerContext, type OwnerContext } from "@/lib/auth/owner-context";
import { recoveryVerifyRateLimit } from "@/lib/redis";
import { findOwnerByEmail, verifyLoginCode, executeMergeOwners } from "@/lib/queries/recovery";
import { t } from "@/lib/i18n/fr";

// Vérification du code de fusion (#14, décision n°6) — revue 2026-09-12.
vi.mock("@/lib/auth/owner-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/owner-context")>()),
  getOwnerContext: vi.fn(),
}));
vi.mock("@/lib/redis", () => ({ recoveryVerifyRateLimit: { limit: vi.fn() } }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "10.0.0.1" })),
}));
vi.mock("@/lib/queries/recovery", () => ({
  findOwnerByEmail: vi.fn(),
  verifyLoginCode: vi.fn(),
  executeMergeOwners: vi.fn(),
}));

function owner(overrides: Partial<OwnerContext> = {}): OwnerContext {
  return {
    ownerId: "owner-1",
    ownerName: null,
    ownerAlias: null,
    recoveryEmail: null,
    sessionId: "session-1",
    memberships: [{ householdId: "household-1", role: "member", isDemo: false }],
    ...overrides,
  };
}

function request(body: unknown, raw = false): NextRequest {
  return new NextRequest("https://test.local/api/owner/email/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOwnerContext).mockResolvedValue(owner());
  vi.mocked(recoveryVerifyRateLimit.limit).mockResolvedValue({ success: true } as never);
});

describe("POST /api/owner/email/verify", () => {
  it("code valide : fusion source (session) → cible (owner de l'email), redirect /household", async () => {
    vi.mocked(findOwnerByEmail).mockResolvedValue({ id: "owner-target" });
    vi.mocked(verifyLoginCode).mockResolvedValue(true);
    const res = await POST(request({ email: "a@b.fr", code: "123456" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirect: "/household" });
    expect(verifyLoginCode).toHaveBeenCalledWith("owner-target", "merge", "123456");
    expect(executeMergeOwners).toHaveBeenCalledWith("owner-1", "owner-target");
  });

  it.each([
    ["cible inconnue", () => vi.mocked(findOwnerByEmail).mockResolvedValue(null)],
    ["cible = soi-même", () => vi.mocked(findOwnerByEmail).mockResolvedValue({ id: "owner-1" })],
    ["code faux", () => { vi.mocked(findOwnerByEmail).mockResolvedValue({ id: "owner-target" }); vi.mocked(verifyLoginCode).mockResolvedValue(false); }],
  ])("%s → 400 générique, aucune fusion", async (_label, arrange) => {
    arrange();
    const res = await POST(request({ email: "a@b.fr", code: "123456" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(t.merge.codeInvalid);
    expect(executeMergeOwners).not.toHaveBeenCalled();
  });

  it("corps invalide → 422, illisible → 400, avant tout accès", async () => {
    expect((await POST(request({ email: "a@b.fr", code: "12" }))).status).toBe(422);
    expect((await POST(request("{oops", true))).status).toBe(400);
    expect(findOwnerByEmail).not.toHaveBeenCalled();
  });

  it("429 par IP (bruteforce du code de fusion)", async () => {
    vi.mocked(recoveryVerifyRateLimit.limit).mockResolvedValue({ success: false } as never);
    expect((await POST(request({ email: "a@b.fr", code: "123456" }))).status).toBe(429);
  });

  it("403 « monde gelé » pour un visiteur démo (garde par défaut)", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(
      owner({ memberships: [{ householdId: "demo", role: "member", isDemo: true }] }),
    );
    expect((await POST(request({ email: "a@b.fr", code: "123456" }))).status).toBe(403);
  });

  it("401 sans session", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(null);
    expect((await POST(request({ email: "a@b.fr", code: "123456" }))).status).toBe(401);
  });
});
