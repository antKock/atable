import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
});

function request(auth?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = auth;
  return new NextRequest("https://test.local/api/cron/demo-reset", { headers });
}

describe("GET /api/cron/demo-reset (Fix 1.5)", () => {
  it("exposes a GET handler (Vercel Cron sends GET, not POST)", () => {
    expect(typeof GET).toBe("function");
  });

  it("returns 401 with no authorization header", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it("returns 401 with a wrong bearer token", async () => {
    const res = await GET(request("Bearer wrong-token"));
    expect(res.status).toBe(401);
  });

  it("resets the demo household with the correct token", async () => {
    supa.queueResult({ count: 3, error: null });
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reset: true, deleted: 3, restored: 0 });
  });

  it("deletes only is_seed=false rows", async () => {
    supa.queueResult({ count: 0, error: null });
    await GET(request("Bearer test-cron-secret"));
    const recipesCall = supa.calls.find((c) => c.table === "recipes")!;
    expect(recipesCall.ops.some((op) => op.method === "delete")).toBe(true);
    expect(
      recipesCall.ops.some(
        (op) =>
          op.method === "eq" && op.args[0] === "is_seed" && op.args[1] === false,
      ),
    ).toBe(true);
  });

  it("returns 500 when the delete fails", async () => {
    supa.queueResult({ count: null, error: { message: "db error" } });
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(500);
  });
});
