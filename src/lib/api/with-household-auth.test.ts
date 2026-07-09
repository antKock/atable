import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { withHouseholdAuth, type AuthContext } from "./with-household-auth";
import { getOwnerContext, type OwnerContext } from "@/lib/auth/owner-context";

vi.mock("@/lib/auth/owner-context", () => ({ getOwnerContext: vi.fn() }));

const mockGetOwnerContext = vi.mocked(getOwnerContext);

function ownerContext(overrides: Partial<OwnerContext> = {}): OwnerContext {
  return {
    ownerId: "owner-1",
    sessionId: "session-1",
    memberships: [{ householdId: "household-1", role: "member", isDemo: false }],
    ...overrides,
  };
}

function request(): NextRequest {
  return new NextRequest("https://test.local/api/whatever", { method: "GET" });
}

beforeEach(() => {
  mockGetOwnerContext.mockResolvedValue(ownerContext());
});

// Compat transitoire Lot 0 : même contrat qu'avant (householdId + sessionId),
// mais résolu via l'owner (unique membership) au lieu du hid du JWT.
describe("withHouseholdAuth (compat owner-context)", () => {
  it("fournit householdId (unique membership) et sessionId", async () => {
    let seen: AuthContext | undefined;
    const res = await withHouseholdAuth(async (_req, _ctx, auth) => {
      seen = auth;
      return NextResponse.json({ ok: true });
    })(request());
    expect(res.status).toBe(200);
    expect(seen).toEqual({ householdId: "household-1", sessionId: "session-1" });
  });

  it("401 quand la session ne se résout pas", async () => {
    mockGetOwnerContext.mockResolvedValue(null);
    const res = await withHouseholdAuth(async () =>
      NextResponse.json({ ok: true }),
    )(request());
    expect(res.status).toBe(401);
  });

  it("401 quand l'owner n'a aucun membership", async () => {
    mockGetOwnerContext.mockResolvedValue(ownerContext({ memberships: [] }));
    const res = await withHouseholdAuth(async () =>
      NextResponse.json({ ok: true }),
    )(request());
    expect(res.status).toBe(401);
  });

  it("500 générique quand le handler jette", async () => {
    const res = await withHouseholdAuth(async () => {
      throw new Error("secret db detail");
    })(request());
    expect(res.status).toBe(500);
    expect(await (res as NextResponse).json()).toEqual({ error: "Erreur serveur" });
  });
});
