import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  withOwnerAuth,
  requireMember,
  assertNotDemoMutation,
  resolveWriteHousehold,
} from "./with-owner-auth";
import { getOwnerContext, type OwnerContext } from "@/lib/auth/owner-context";
import { t } from "@/lib/i18n/fr";

// Seul getOwnerContext est mocké ; les helpers purs (memberHouseholdIds…)
// restent réels — resolveWriteHousehold en dépend.
vi.mock("@/lib/auth/owner-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/owner-context")>();
  return { ...actual, getOwnerContext: vi.fn() };
});

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

function request(): NextRequest {
  return new NextRequest("https://test.local/api/whatever", { method: "POST" });
}

beforeEach(() => {
  mockGetOwnerContext.mockResolvedValue(ownerContext());
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

  it("500 générique quand le handler jette", async () => {
    const res = await withOwnerAuth(async () => {
      throw new Error("secret db detail");
    })(request());
    expect(res.status).toBe(500);
    expect(await (res as NextResponse).json()).toEqual({ error: "Erreur serveur" });
  });
});

describe("requireMember", () => {
  it("null (OK) pour un membership member", () => {
    expect(requireMember(ownerContext(), "household-1")).toBeNull();
  });

  it("403 pour un invité (lecture seule)", () => {
    const ctx = ownerContext({
      memberships: [{ householdId: "household-1", role: "guest", isDemo: false }],
    });
    expect(requireMember(ctx, "household-1")?.status).toBe(403);
  });

  it("403 sans membership sur le foyer visé", () => {
    expect(requireMember(ownerContext(), "household-other")?.status).toBe(403);
  });
});

describe("assertNotDemoMutation", () => {
  it("403 sur une mutation visant le foyer démo", async () => {
    const ctx = ownerContext({
      memberships: [{ householdId: "hh-demo", role: "member", isDemo: true }],
    });
    const res = assertNotDemoMutation(ctx, "hh-demo");
    expect(res?.status).toBe(403);
    expect(await res!.json()).toEqual({ error: t.demo.frozen });
  });

  it("null (OK) pour un foyer normal", () => {
    expect(assertNotDemoMutation(ownerContext(), "household-1")).toBeNull();
  });

  it("null sans membership (requireMember porte ce cas)", () => {
    expect(assertNotDemoMutation(ownerContext(), "household-other")).toBeNull();
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

  it("foyer explicite membre → retenu", () => {
    expect(resolveWriteHousehold(multi, "B")).toEqual({ householdId: "B" });
  });

  it("foyer explicite où l'owner n'est PAS membre (invité) → 403", () => {
    const res = resolveWriteHousehold(multi, "C");
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(403);
  });

  it("foyer explicite inconnu → 403", () => {
    expect((resolveWriteHousehold(multi, "Z") as NextResponse).status).toBe(403);
  });

  it("absent + mono-foyer membre → repli sur l'unique foyer", () => {
    expect(resolveWriteHousehold(ownerContext(), undefined)).toEqual({
      householdId: "household-1",
    });
  });

  it("absent + plusieurs foyers membres → 422 (choix requis)", () => {
    const res = resolveWriteHousehold(multi, undefined);
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(422);
  });

  it("absent + aucun foyer membre (invité partout) → 403", () => {
    const guest = ownerContext({
      memberships: [{ householdId: "C", role: "guest", isDemo: false }],
    });
    expect((resolveWriteHousehold(guest, undefined) as NextResponse).status).toBe(403);
  });
});
