import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { POST } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { joinRateLimit, joinCodeRateLimit } from "@/lib/redis";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/redis", () => ({
  redis: { get: vi.fn() },
  joinRateLimit: { limit: vi.fn() },
  joinCodeRateLimit: { limit: vi.fn() },
}));

const mockHeaders = headers as unknown as Mock;
const mockLimit = joinRateLimit.limit as unknown as Mock;
const mockCodeLimit = joinCodeRateLimit.limit as unknown as Mock;

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  mockHeaders.mockResolvedValue(
    new Headers({ "user-agent": "Mozilla/5.0", "x-forwarded-for": "1.2.3.4" }),
  );
  mockLimit.mockResolvedValue({ success: true });
  mockCodeLimit.mockResolvedValue({ success: true });
});

function request(body: unknown): NextRequest {
  return new NextRequest("https://test.local/api/households/join", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/households/join (Fix 1.2)", () => {
  /** Queue the 4 results a successful join consumes (Lot 0 foyer). */
  function queueSuccess(name = "Famille Dupont") {
    supa.queueResults([
      { data: { id: "household-1", name }, error: null }, // lookup by code
      { data: { id: "owner-1" }, error: null }, // insert owner
      { error: null }, // insert membership
      { data: { id: "session-1" }, error: null }, // insert device_session
    ]);
  }

  it("joins a household and returns 200 JSON with a redirect", async () => {
    queueSuccess();
    const res = await POST(request({ code: "OLIVE-4821" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirect: "/home" });
  });

  it("creates owner + membership member, session pointing at the owner (Lot 0)", async () => {
    queueSuccess();
    await POST(request({ code: "OLIVE-4821" }));
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

  it("sets the atable_session cookie", async () => {
    queueSuccess("Famille");
    const res = await POST(request({ code: "OLIVE-4821" }));
    expect(res.cookies.get("atable_session")?.value).toBeTruthy();
  });

  it("does NOT issue a 303 redirect (regression guard)", async () => {
    queueSuccess("Famille");
    const res = await POST(request({ code: "OLIVE-4821" }));
    expect(res.status).not.toBe(303);
  });

  it("rejects an invalid code format with 400", async () => {
    const res = await POST(request({ code: "not-a-code" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate-limited", async () => {
    mockLimit.mockResolvedValue({ success: false });
    const res = await POST(request({ code: "OLIVE-4821" }));
    expect(res.status).toBe(429);
  });

  it("returns 429 when the code itself is rate-limited (distributed brute-force)", async () => {
    mockCodeLimit.mockResolvedValue({ success: false });
    const res = await POST(request({ code: "OLIVE-4821" }));
    expect(res.status).toBe(429);
    expect(mockCodeLimit).toHaveBeenCalledWith("OLIVE-4821");
  });

  it("returns 404 when the code matches no household", async () => {
    supa.queueResult({ data: null, error: { message: "no rows" } });
    const res = await POST(request({ code: "OLIVE-4821" }));
    expect(res.status).toBe(404);
  });
});
