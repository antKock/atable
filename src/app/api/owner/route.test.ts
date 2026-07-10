import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { getOwnerContext, type OwnerContext } from "@/lib/auth/owner-context";
import { t } from "@/lib/i18n/fr";
import { createSupabaseMock, findCall, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/owner-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/owner-context")>()),
  getOwnerContext: vi.fn(),
}));

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
});

function owner(overrides: Partial<OwnerContext> = {}): OwnerContext {
  return {
    ownerId: "owner-1",
    ownerName: null,
    sessionId: "session-1",
    memberships: [{ householdId: "household-1", role: "member", isDemo: false }],
    ...overrides,
  };
}

function request(body: unknown): NextRequest {
  return new NextRequest("https://test.local/api/owner", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/owner", () => {
  it("401 sans session résolue", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(null);
    const res = await PUT(request({ name: "Anthony" }));
    expect(res.status).toBe(401);
  });

  it("enregistre le nom trimé et le renvoie", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(owner());
    supa.queueResult({ error: null });
    const res = await PUT(request({ name: "  Anthony " }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: "Anthony" });
    const call = findCall(supa, "owners");
    expect(call?.ops.some((o) => o.method === "update" && (o.args[0] as { name: string }).name === "Anthony")).toBe(true);
    expect(call?.ops.some((o) => o.method === "eq" && o.args[1] === "owner-1")).toBe(true);
  });

  it("nom vide → NULL en DB (l'alias auto prend le relais à l'affichage)", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(owner());
    supa.queueResult({ error: null });
    const res = await PUT(request({ name: "   " }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: null });
    const call = findCall(supa, "owners");
    expect(call?.ops.some((o) => o.method === "update" && (o.args[0] as { name: null }).name === null)).toBe(true);
  });

  it("403 gelé pour une session démo (stratégie C), sans écriture DB", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(
      owner({ memberships: [{ householdId: "hh-demo", role: "member", isDemo: true }] }),
    );
    const res = await PUT(request({ name: "Intrus" }));
    expect(res.status).toBe(403);
    expect(supa.calls).toHaveLength(0);
  });

  it("400 si le nom dépasse 50 caractères", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(owner());
    const res = await PUT(request({ name: "x".repeat(51) }));
    expect(res.status).toBe(400);
  });

  // Une entrée invalide est un 400, pas un 500 + Sentry : `body.name` sur un
  // corps `null` ou non-JSON jetterait sans ces gardes.
  it.each([
    ["corps JSON null", "null"],
    ["corps non-JSON", "{ pas du json"],
    ["corps vide", ""],
  ])("400 (pas 500) sur %s", async (_label, body) => {
    vi.mocked(getOwnerContext).mockResolvedValue(owner());
    const req = new NextRequest("https://test.local/api/owner", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body,
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect(supa.calls).toHaveLength(0);
  });

  it("les messages d'erreur sont en français (convention wording)", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(owner());
    supa.queueResult({ error: { message: "db down" } });
    const res = await PUT(request({ name: "Anthony" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(t.profile.saveError);
  });
});
