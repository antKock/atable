import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { headers } from "next/headers";
import {
  resolveOwnerContext,
  getOwnerContext,
  isGuestOwner,
  memberHouseholdIds,
  householdIds,
  roleForHousehold,
  planRoleMerge,
  type OwnerContext,
} from "./owner-context";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, findCall, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const mockHeaders = headers as unknown as Mock;

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
});

/** Ligne device_sessions telle que la renvoie la requête embarquée PostgREST. */
function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    owner_id: "owner-1",
    is_revoked: false,
    owners: {
      name: null,
      recovery_email: null,
      memberships: [
        { household_id: "household-1", role: "member", households: { is_demo: false } },
      ],
    },
    ...overrides,
  };
}

describe("resolveOwnerContext", () => {
  it("résout session → owner → memberships", async () => {
    supa.queueResult({ data: sessionRow(), error: null });
    const ctx = await resolveOwnerContext("session-1");
    expect(ctx).toEqual({
      ownerId: "owner-1",
      ownerName: null,
      recoveryEmail: null,
      sessionId: "session-1",
      memberships: [{ householdId: "household-1", role: "member", isDemo: false }],
    });
  });

  it("remonte l'email de secours quand il est posé", async () => {
    supa.queueResult({
      data: sessionRow({
        owners: { name: null, recovery_email: "a@ex.fr", memberships: [] },
      }),
      error: null,
    });
    const ctx = await resolveOwnerContext("session-1");
    expect(ctx?.recoveryEmail).toBe("a@ex.fr");
  });

  it("remonte le nom de l'owner quand il en a un", async () => {
    supa.queueResult({
      data: sessionRow({
        owners: { name: "Anthony", memberships: [] },
      }),
      error: null,
    });
    const ctx = await resolveOwnerContext("session-1");
    expect(ctx?.ownerName).toBe("Anthony");
  });

  it("mappe rôle guest et foyer démo", async () => {
    supa.queueResult({
      data: sessionRow({
        owners: {
          memberships: [
            { household_id: "hh-demo", role: "guest", households: { is_demo: true } },
          ],
        },
      }),
      error: null,
    });
    const ctx = await resolveOwnerContext("session-1");
    expect(ctx?.memberships).toEqual([
      { householdId: "hh-demo", role: "guest", isDemo: true },
    ]);
  });

  it("session inconnue → null", async () => {
    supa.queueResult({ data: null, error: null });
    expect(await resolveOwnerContext("session-ghost")).toBeNull();
  });

  it("session révoquée → null", async () => {
    supa.queueResult({ data: sessionRow({ is_revoked: true }), error: null });
    expect(await resolveOwnerContext("session-1")).toBeNull();
  });

  it("session sans owner (fenêtre migration → deploy) → null", async () => {
    supa.queueResult({ data: sessionRow({ owner_id: null, owners: null }), error: null });
    expect(await resolveOwnerContext("session-1")).toBeNull();
  });

  it("erreur DB → propage (ne pas confondre avec une session inconnue)", async () => {
    supa.queueResult({ data: null, error: { message: "boom" } });
    await expect(resolveOwnerContext("session-1")).rejects.toThrow(/boom/);
  });

  it("owner sans membership → contexte avec liste vide", async () => {
    supa.queueResult({ data: sessionRow({ owners: { memberships: [] } }), error: null });
    const ctx = await resolveOwnerContext("session-1");
    expect(ctx?.memberships).toEqual([]);
  });
});

describe("getOwnerContext", () => {
  it("résout depuis le header x-session-id", async () => {
    mockHeaders.mockResolvedValue(new Headers({ "x-session-id": "session-1" }));
    supa.queueResult({ data: sessionRow(), error: null });
    const ctx = await getOwnerContext();
    expect(ctx?.ownerId).toBe("owner-1");
    const call = findCall(supa, "device_sessions");
    expect(call?.ops.some((o) => o.method === "eq" && o.args[1] === "session-1")).toBe(true);
  });

  it("header absent → null sans requête DB", async () => {
    mockHeaders.mockResolvedValue(new Headers());
    expect(await getOwnerContext()).toBeNull();
    expect(supa.calls.length).toBe(0);
  });
});

// Helpers multi-appartenance (Lot 4) — logique pure, pas de DB.
function owner(memberships: OwnerContext["memberships"]): OwnerContext {
  return {
    ownerId: "owner-1",
    ownerName: null,
    recoveryEmail: null,
    sessionId: "session-1",
    memberships,
  };
}

describe("isGuestOwner (invité PARTOUT)", () => {
  it("false si l'owner est membre d'au moins un foyer", () => {
    expect(
      isGuestOwner(
        owner([
          { householdId: "A", role: "member", isDemo: false },
          { householdId: "C", role: "guest", isDemo: false },
        ]),
      ),
    ).toBe(false);
  });

  it("true si l'owner n'est que invité", () => {
    expect(isGuestOwner(owner([{ householdId: "C", role: "guest", isDemo: false }]))).toBe(true);
  });

  it("true si aucun membership", () => {
    expect(isGuestOwner(owner([]))).toBe(true);
  });
});

describe("memberHouseholdIds / householdIds / roleForHousehold", () => {
  const o = owner([
    { householdId: "A", role: "member", isDemo: false },
    { householdId: "B", role: "member", isDemo: false },
    { householdId: "C", role: "guest", isDemo: false },
  ]);

  it("memberHouseholdIds ne garde que les foyers membres", () => {
    expect(memberHouseholdIds(o)).toEqual(["A", "B"]);
  });

  it("householdIds garde l'union (membre + invité)", () => {
    expect(householdIds(o)).toEqual(["A", "B", "C"]);
  });

  it("roleForHousehold rend le rôle du foyer, ou null hors appartenance", () => {
    expect(roleForHousehold(o, "A")).toBe("member");
    expect(roleForHousehold(o, "C")).toBe("guest");
    expect(roleForHousehold(o, "Z")).toBeNull();
  });
});

describe("planRoleMerge (re-join additif)", () => {
  it("pas encore membre → add", () => {
    expect(planRoleMerge(null, "member")).toEqual({ action: "add", role: "member" });
    expect(planRoleMerge(null, "guest")).toEqual({ action: "add", role: "guest" });
  });

  it("invité + code membre → upgrade", () => {
    expect(planRoleMerge("guest", "member")).toEqual({ action: "upgrade", role: "member" });
  });

  it("membre + code invité → noop (jamais de rétrogradation)", () => {
    expect(planRoleMerge("member", "guest")).toEqual({ action: "noop", role: "member" });
  });

  it("rôle identique → noop", () => {
    expect(planRoleMerge("member", "member")).toEqual({ action: "noop", role: "member" });
    expect(planRoleMerge("guest", "guest")).toEqual({ action: "noop", role: "guest" });
  });
});
