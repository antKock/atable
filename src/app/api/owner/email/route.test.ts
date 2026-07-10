import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { getOwnerContext, type OwnerContext } from "@/lib/auth/owner-context";
import { recoveryEmailRateLimit } from "@/lib/redis";
import { createLoginToken } from "@/lib/queries/recovery";
import { sendRecoveryEmail } from "@/lib/email/send";
import { t } from "@/lib/i18n/fr";
import { createSupabaseMock, findCall, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/auth/owner-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/owner-context")>()),
  getOwnerContext: vi.fn(),
}));
vi.mock("@/lib/redis", () => ({
  recoveryEmailRateLimit: { limit: vi.fn(async () => ({ success: true })) },
}));
vi.mock("@/lib/queries/recovery", () => ({
  createLoginToken: vi.fn(async () => ({ token: "TOKENxyz", code: "482913" })),
}));
vi.mock("@/lib/email/send", () => ({ sendRecoveryEmail: vi.fn(async () => {}) }));

let supa: SupabaseMock;

beforeEach(() => {
  vi.clearAllMocks();
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  vi.mocked(recoveryEmailRateLimit.limit).mockResolvedValue(
    { success: true } as Awaited<ReturnType<typeof recoveryEmailRateLimit.limit>>,
  );
});

function owner(overrides: Partial<OwnerContext> = {}): OwnerContext {
  return {
    ownerId: "owner-1",
    ownerName: null,
    recoveryEmail: null,
    sessionId: "session-1",
    memberships: [{ householdId: "household-1", role: "member", isDemo: false }],
    ...overrides,
  };
}

function request(body: unknown): NextRequest {
  return new NextRequest("https://test.local/api/owner/email", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/owner/email", () => {
  it("401 sans session résolue", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(null);
    const res = await PUT(request({ email: "a@ex.fr" }));
    expect(res.status).toBe(401);
  });

  it("403 gelé pour une session démo (owner-level, comme PUT /api/owner)", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(
      owner({ memberships: [{ householdId: "hh-demo", role: "member", isDemo: true }] }),
    );
    const res = await PUT(request({ email: "a@ex.fr" }));
    expect(res.status).toBe(403);
    expect(supa.calls).toHaveLength(0);
  });

  it("normalise (trim + lowercase) et stocke quand l'email est libre", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(owner());
    supa.queueResults([
      { data: null, error: null }, // lookup collision : personne
      { error: null }, // update
    ]);
    const res = await PUT(request({ email: "  A.Kocken@GMAIL.com " }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "a.kocken@gmail.com" });
    const update = supa.calls.filter((c) => c.table === "owners").at(-1);
    expect(
      update?.ops.some(
        (o) =>
          o.method === "update" &&
          (o.args[0] as { recovery_email: string }).recovery_email === "a.kocken@gmail.com",
      ),
    ).toBe(true);
    // AUCUN envoi à la saisie (décision n°1)
    expect(sendRecoveryEmail).not.toHaveBeenCalled();
    expect(createLoginToken).not.toHaveBeenCalled();
  });

  it("email vide → NULL en DB (retrait, symétrique du nom)", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(owner({ recoveryEmail: "a@ex.fr" }));
    supa.queueResult({ error: null });
    const res = await PUT(request({ email: "  " }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: null });
    const call = findCall(supa, "owners");
    expect(
      call?.ops.some(
        (o) =>
          o.method === "update" &&
          (o.args[0] as { recovery_email: null }).recovery_email === null,
      ),
    ).toBe(true);
  });

  it("même email que l'actuel → no-op sans écriture", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(owner({ recoveryEmail: "a@ex.fr" }));
    const res = await PUT(request({ email: "A@ex.fr" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "a@ex.fr" });
    expect(supa.calls).toHaveLength(0);
  });

  it("collision → { merge: true }, token merge vers la CIBLE, email envoyé, rien stocké", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(owner());
    supa.queueResult({ data: { id: "owner-cible" }, error: null }); // lookup collision
    const res = await PUT(request({ email: "deja@pris.fr" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ merge: true });
    expect(createLoginToken).toHaveBeenCalledWith("owner-cible", "merge");
    expect(sendRecoveryEmail).toHaveBeenCalledWith(
      "deja@pris.fr",
      expect.objectContaining({ code: "482913", kind: "merge" }),
    );
    const magicLink = vi.mocked(sendRecoveryEmail).mock.calls[0][1].magicLink;
    expect(magicLink).toBe("https://test.local/recover/TOKENxyz");
    // Pas d'update owners : l'email appartient à la cible
    expect(supa.calls.filter((c) => c.table === "owners")).toHaveLength(1);
  });

  it("collision rate-limitée par adresse → 429 sans envoi", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(owner());
    vi.mocked(recoveryEmailRateLimit.limit).mockResolvedValue(
      { success: false } as Awaited<ReturnType<typeof recoveryEmailRateLimit.limit>>,
    );
    supa.queueResult({ data: { id: "owner-cible" }, error: null });
    const res = await PUT(request({ email: "deja@pris.fr" }));
    expect(res.status).toBe(429);
    expect(sendRecoveryEmail).not.toHaveBeenCalled();
  });

  it("400 sur un format invalide", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(owner());
    const res = await PUT(request({ email: "pas-un-email" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(t.profile.emailInvalid);
    expect(supa.calls).toHaveLength(0);
  });

  it("400 (pas 500) sur un corps non-JSON", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(owner());
    const req = new NextRequest("https://test.local/api/owner/email", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{ pas du json",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect(supa.calls).toHaveLength(0);
  });
});
