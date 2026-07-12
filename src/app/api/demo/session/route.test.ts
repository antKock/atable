import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
});

function request(): NextRequest {
  return new NextRequest("https://test.local/api/demo/session", {
    method: "POST",
    headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
  });
}

/** Queue the 3 results a successful demo session consumes (Lot 0 foyer). */
function queueSuccess() {
  supa.queueResults([
    { data: { id: "owner-1" }, error: null }, // insert owner
    { error: null }, // insert membership
    { data: { id: "session-1" }, error: null }, // insert device_session
  ]);
}

describe("POST /api/demo/session (Fix 1.2)", () => {
  it("creates a session and returns 200 JSON with a redirect", async () => {
    queueSuccess();
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirect: "/home" });
  });

  it("creates owner + membership member on the demo household (Lot 0)", async () => {
    queueSuccess();
    await POST(request());
    // Id owner généré côté app (alias figé) : lu du payload, pas supposé.
    const ownerInsert = supa.calls
      .find((c) => c.table === "owners")!
      .ops.find((op) => op.method === "insert");
    const owner = ownerInsert!.args[0] as { id: string; alias: string };
    expect(owner.id).toBeTruthy();
    expect(owner.alias).toBeTruthy();
    const membership = supa.calls.find((c) => c.table === "memberships")!;
    expect(
      membership.ops.some(
        (op) =>
          op.method === "insert" &&
          JSON.stringify(op.args[0]) ===
            JSON.stringify({
              owner_id: owner.id,
              household_id: process.env.DEMO_HOUSEHOLD_ID,
              role: "member",
            }),
      ),
    ).toBe(true);
  });

  it("sets the atable_session cookie on the JSON response", async () => {
    queueSuccess();
    const res = await POST(request());
    const cookie = res.cookies.get("atable_session");
    expect(cookie?.value).toBeTruthy();
    expect(cookie!.value.length).toBeGreaterThan(10);
  });

  it("does NOT issue a 303 redirect (regression guard)", async () => {
    queueSuccess();
    const res = await POST(request());
    expect(res.status).not.toBe(303);
    expect(res.headers.get("location")).toBeNull();
  });

  it("returns 500 when the owner insert fails", async () => {
    supa.queueResult({ data: null, error: { message: "insert failed" } });
    const res = await POST(request());
    expect(res.status).toBe(500);
  });

  it("returns 500 and compensates (owner deleted) when the session insert fails", async () => {
    supa.queueResults([
      { data: { id: "owner-1" }, error: null },
      { error: null }, // membership
      { data: null, error: { message: "insert failed" } },
    ]);
    const res = await POST(request());
    expect(res.status).toBe(500);
    expect(
      supa.calls.some(
        (c) => c.table === "owners" && c.ops.some((op) => op.method === "delete"),
      ),
    ).toBe(true);
  });
});
