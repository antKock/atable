import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { headers } from "next/headers";
import { resolveOwnerContext, getOwnerContext } from "./owner-context";
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
      sessionId: "session-1",
      memberships: [{ householdId: "household-1", role: "member", isDemo: false }],
    });
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
