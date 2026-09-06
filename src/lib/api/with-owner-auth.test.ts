import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  withOwnerAuth,
  requireMember,
  resolveWriteHousehold,
  assertNotDemoSeedMutation,
} from "./with-owner-auth";
import { getOwnerContext, type OwnerContext } from "@/lib/auth/owner-context";
import { trackStat } from "@/lib/admin/track-stat";
import { t } from "@/lib/i18n/fr";

// Seul getOwnerContext est mocké ; les helpers purs (memberHouseholdIds…)
// restent réels — resolveWriteHousehold en dépend.
vi.mock("@/lib/auth/owner-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/owner-context")>();
  return { ...actual, getOwnerContext: vi.fn() };
});
// Compteur produit demo_frozen_hits : on vérifie l'émission, pas l'écriture DB.
vi.mock("@/lib/admin/track-stat", () => ({ trackStat: vi.fn() }));

const mockGetOwnerContext = vi.mocked(getOwnerContext);

function ownerContext(overrides: Partial<OwnerContext> = {}): OwnerContext {
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

function request(headers: Record<string, string> = {}, method = "POST"): NextRequest {
  return new NextRequest("https://test.local/api/whatever", { method, headers });
}

const demoOwner = ownerContext({
  memberships: [{ householdId: "hh-demo", role: "member", isDemo: true }],
});

beforeEach(() => {
  mockGetOwnerContext.mockResolvedValue(ownerContext());
  vi.mocked(trackStat).mockClear();
});

describe("withOwnerAuth", () => {
  it("passe le contexte owner au handler", async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const res = await withOwnerAuth(handler)(request());
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      ownerContext(),
    );
  });

  it("401 quand la session ne se résout pas", async () => {
    mockGetOwnerContext.mockResolvedValue(null);
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const res = await withOwnerAuth(handler)(request());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("500 (pas 401) quand la résolution de session échoue — un 401 purgerait le cookie", async () => {
    mockGetOwnerContext.mockRejectedValue(new Error("db down"));
    const res = await withOwnerAuth(async () => NextResponse.json({ ok: true }))(request());
    expect(res.status).toBe(500);
  });

  it("413 AVANT la session quand content-length dépasse le plafond par défaut (1 Mo)", async () => {
    mockGetOwnerContext.mockClear();
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const res = await withOwnerAuth(handler)(
      request({ "content-length": String(1024 * 1024 + 1) }),
    );
    expect(res.status).toBe(413);
    expect(await (res as NextResponse).json()).toMatchObject({
      error: t.api.bodyTooLarge,
      code: "BODY_TOO_LARGE",
    });
    expect(handler).not.toHaveBeenCalled();
    expect(mockGetOwnerContext).not.toHaveBeenCalled();
  });

  it("laisse passer un corps sous le plafond, ou sans content-length (chunked)", async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    expect((await withOwnerAuth(handler)(request({ "content-length": "1024" }))).status).toBe(200);
    expect((await withOwnerAuth(handler)(request())).status).toBe(200);
  });

  it("maxBodyBytes relève le plafond pour les routes fichier (photo, capture, voix)", async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const big = request({ "content-length": String(3 * 1024 * 1024) });
    expect((await withOwnerAuth(handler)(big)).status).toBe(413);
    expect((await withOwnerAuth(handler, { maxBodyBytes: 4 * 1024 * 1024 })(big)).status).toBe(200);
  });

  it("500 générique quand le handler jette", async () => {
    const res = await withOwnerAuth(async () => {
      throw new Error("secret db detail");
    })(request());
    expect(res.status).toBe(500);
    expect(await (res as NextResponse).json()).toEqual({ error: "Erreur serveur" });
  });
});

describe("withOwnerAuth — garde démo par défaut (monde gelé)", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "%s d'un owner démo → 403 gelé avant le handler, compteur demo_frozen_hits",
    async (method) => {
      mockGetOwnerContext.mockResolvedValue(demoOwner);
      const handler = vi.fn(async () => NextResponse.json({ ok: true }));
      const res = await withOwnerAuth(handler)(request({}, method));
      expect(res.status).toBe(403);
      expect(await (res as NextResponse).json()).toEqual({ error: t.demo.frozen });
      expect(handler).not.toHaveBeenCalled();
      expect(trackStat).toHaveBeenCalledWith("demo_frozen_hits");
    },
  );

  it.each(["GET", "HEAD", "OPTIONS"])("%s d'un owner démo → laissé passer", async (method) => {
    mockGetOwnerContext.mockResolvedValue(demoOwner);
    const handler = vi.fn(async () => new NextResponse(null, { status: 200 }));
    const res = await withOwnerAuth(handler)(request({}, method));
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
    expect(trackStat).not.toHaveBeenCalled();
  });

  it("owner-level : un membership démo parmi d'autres suffit à geler", async () => {
    mockGetOwnerContext.mockResolvedValue(
      ownerContext({
        memberships: [
          { householdId: "household-1", role: "member", isDemo: false },
          { householdId: "hh-demo", role: "member", isDemo: true },
        ],
      }),
    );
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    expect((await withOwnerAuth(handler)(request())).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("mutation d'un owner normal → laissée passer, pas de compteur", async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    expect((await withOwnerAuth(handler)(request())).status).toBe(200);
    expect(trackStat).not.toHaveBeenCalled();
  });

  it("opt-out allowDemoMutation → le handler reçoit la mutation démo", async () => {
    mockGetOwnerContext.mockResolvedValue(demoOwner);
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const res = await withOwnerAuth(handler, { allowDemoMutation: true })(request({}, "DELETE"));
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(expect.anything(), undefined, demoOwner);
    expect(trackStat).not.toHaveBeenCalled();
  });

  it("la garde passe APRÈS la session (401 prime) et le plafond de corps (413 prime)", async () => {
    mockGetOwnerContext.mockResolvedValue(null);
    expect((await withOwnerAuth(async () => NextResponse.json({}))(request())).status).toBe(401);

    mockGetOwnerContext.mockResolvedValue(demoOwner);
    const res = await withOwnerAuth(async () => NextResponse.json({}))(
      request({ "content-length": String(1024 * 1024 + 1) }),
    );
    expect(res.status).toBe(413);
    expect(trackStat).not.toHaveBeenCalled();
  });
});

describe("requireMember", () => {
  it("null (OK) pour un membership member", async () => {
    expect(await requireMember(ownerContext(), "household-1")).toBeNull();
  });

  it("403 pour un invité (lecture seule), message localisé", async () => {
    const ctx = ownerContext({
      memberships: [{ householdId: "household-1", role: "guest", isDemo: false }],
    });
    const res = await requireMember(ctx, "household-1");
    expect(res?.status).toBe(403);
    expect(await res!.json()).toEqual({ error: t.api.forbidden });
  });

  it("403 sans membership sur le foyer visé", async () => {
    expect((await requireMember(ownerContext(), "household-other"))?.status).toBe(403);
  });
});

describe("assertNotDemoSeedMutation (incident démo 2026-09, garde fine des routes recette)", () => {
  it("403 sur une recette seed du foyer démo, compteur demo_frozen_hits", async () => {
    const res = await assertNotDemoSeedMutation(demoOwner, { household_id: "hh-demo", is_seed: true });
    expect(res?.status).toBe(403);
    expect(await res!.json()).toEqual({ error: t.demo.frozen });
    expect(trackStat).toHaveBeenCalledWith("demo_frozen_hits");
  });
  it("null pour une recette ajoutée par le visiteur démo (non seed)", async () => {
    expect(await assertNotDemoSeedMutation(demoOwner, { household_id: "hh-demo", is_seed: false })).toBeNull();
    expect(trackStat).not.toHaveBeenCalled();
  });
  it("null pour une recette seed hors démo (flag vestigial)", async () => {
    expect(await assertNotDemoSeedMutation(ownerContext(), { household_id: "household-1", is_seed: true })).toBeNull();
  });
});

describe("resolveWriteHousehold (fallback householdId, Lot 4)", () => {
  const multi = ownerContext({
    memberships: [
      { householdId: "A", role: "member", isDemo: false },
      { householdId: "B", role: "member", isDemo: false },
      { householdId: "C", role: "guest", isDemo: false },
    ],
  });

  it("foyer explicite membre → retenu", async () => {
    expect(await resolveWriteHousehold(multi, "B")).toEqual({ householdId: "B" });
  });

  it("foyer explicite où l'owner n'est PAS membre (invité) → 403", async () => {
    const res = await resolveWriteHousehold(multi, "C");
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(403);
  });

  it("foyer explicite inconnu → 403", async () => {
    expect(((await resolveWriteHousehold(multi, "Z")) as NextResponse).status).toBe(403);
  });

  it("absent + mono-foyer membre → repli sur l'unique foyer", async () => {
    expect(await resolveWriteHousehold(ownerContext(), undefined)).toEqual({
      householdId: "household-1",
    });
  });

  it("absent + plusieurs foyers membres → 422 (choix requis)", async () => {
    const res = await resolveWriteHousehold(multi, undefined);
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(422);
  });

  it("absent + aucun foyer membre (invité partout) → 403", async () => {
    const guest = ownerContext({
      memberships: [{ householdId: "C", role: "guest", isDemo: false }],
    });
    expect(((await resolveWriteHousehold(guest, undefined)) as NextResponse).status).toBe(403);
  });
});
