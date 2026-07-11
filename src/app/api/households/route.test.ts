import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/import-quota", () => ({
  enforceHouseholdCreateQuota: vi.fn().mockResolvedValue(null),
}));
// cookies() : « Créer un foyer » est additif quand une session existe (Lot 4).
// Par défaut aucun cookie → chemin « owner neuf » (caractérisation historique).
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
});

function request(body: unknown): NextRequest {
  return new NextRequest("https://test.local/api/households", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0",
    },
    body: JSON.stringify(body),
  });
}

/** Queue the 5 results a successful create consumes (Lot 0 foyer). */
function queueSuccess() {
  supa.queueResults([
    { data: { id: "owner-1" }, error: null }, // insert owner
    { data: { id: "household-1" }, error: null }, // insert household
    { error: null }, // insert membership
    { data: { id: "session-1" }, error: null }, // insert device_session
    { error: null }, // migrate legacy recipes
  ]);
}

describe("POST /api/households (Fix 1.2)", () => {
  it("returns 429 when the per-IP creation quota is exhausted", async () => {
    const { enforceHouseholdCreateQuota } = await import("@/lib/import-quota");
    const { NextResponse } = await import("next/server");
    vi.mocked(enforceHouseholdCreateQuota).mockResolvedValueOnce(
      NextResponse.json({ error: "quota" }, { status: 429 }),
    );
    const res = await POST(request({ name: "Chez nous" }));
    expect(res.status).toBe(429);
    expect(supa.calls).toHaveLength(0);
  });

  it("creates a household and returns 200 JSON with a redirect", async () => {
    queueSuccess();
    const res = await POST(request({ name: "Chez nous" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.redirect).toContain("/home?code=");
  });

  it("sets the atable_session cookie", async () => {
    queueSuccess();
    const res = await POST(request({ name: "Chez nous" }));
    expect(res.cookies.get("atable_session")?.value).toBeTruthy();
  });

  it("does NOT issue a 303 redirect (regression guard)", async () => {
    queueSuccess();
    const res = await POST(request({ name: "Chez nous" }));
    expect(res.status).not.toBe(303);
  });

  it("rejects an empty name with 422", async () => {
    const res = await POST(request({ name: "" }));
    expect(res.status).toBe(422);
  });

  it("returns 500 when the household insert fails", async () => {
    supa.queueResults([
      { data: { id: "owner-1" }, error: null },
      { data: null, error: { message: "insert failed" } },
    ]);
    const res = await POST(request({ name: "Chez nous" }));
    expect(res.status).toBe(500);
  });

  it("creates owner + membership, and the session points at the owner (Lot 0)", async () => {
    queueSuccess();
    await POST(request({ name: "Chez nous" }));

    expect(supa.calls.some((c) => c.table === "owners")).toBe(true);
    const membership = supa.calls.find((c) => c.table === "memberships")!;
    expect(
      membership.ops.some(
        (op) =>
          op.method === "insert" &&
          JSON.stringify(op.args[0]) ===
            JSON.stringify({ owner_id: "owner-1", household_id: "household-1", role: "member" }),
      ),
    ).toBe(true);

    const session = supa.calls.find((c) => c.table === "device_sessions")!;
    const insert = session.ops.find((op) => op.method === "insert");
    expect((insert?.args[0] as { owner_id?: string }).owner_id).toBe("owner-1");
  });

  it("compensates (household + owner deleted) when the session insert fails", async () => {
    supa.queueResults([
      { data: { id: "owner-1" }, error: null },
      { data: { id: "household-1" }, error: null },
      { error: null }, // membership
      { data: null, error: { message: "session insert failed" } },
    ]);
    const res = await POST(request({ name: "Chez nous" }));
    expect(res.status).toBe(500);
    const deleted = (table: string) =>
      supa.calls.some(
        (c) => c.table === table && c.ops.some((op) => op.method === "delete"),
      );
    expect(deleted("households")).toBe(true);
    expect(deleted("owners")).toBe(true);
  });
});
