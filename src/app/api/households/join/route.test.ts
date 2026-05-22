import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { POST } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { joinRateLimit } from "@/lib/redis";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/redis", () => ({
  redis: { get: vi.fn() },
  joinRateLimit: { limit: vi.fn() },
}));

const mockHeaders = headers as unknown as Mock;
const mockLimit = joinRateLimit.limit as unknown as Mock;

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  mockHeaders.mockResolvedValue(
    new Headers({ "user-agent": "Mozilla/5.0", "x-forwarded-for": "1.2.3.4" }),
  );
  mockLimit.mockResolvedValue({ success: true });
});

function request(body: unknown): NextRequest {
  return new NextRequest("https://test.local/api/households/join", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/households/join (Fix 1.2)", () => {
  it("joins a household and returns 200 JSON with a redirect", async () => {
    supa.queueResults([
      { data: { id: "household-1", name: "Famille Dupont" }, error: null },
      { data: { id: "session-1" }, error: null },
    ]);
    const res = await POST(request({ code: "OLIVE-4821" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirect: "/home" });
  });

  it("sets the atable_session cookie", async () => {
    supa.queueResults([
      { data: { id: "household-1", name: "Famille" }, error: null },
      { data: { id: "session-1" }, error: null },
    ]);
    const res = await POST(request({ code: "OLIVE-4821" }));
    expect(res.cookies.get("atable_session")?.value).toBeTruthy();
  });

  it("does NOT issue a 303 redirect (regression guard)", async () => {
    supa.queueResults([
      { data: { id: "household-1", name: "Famille" }, error: null },
      { data: { id: "session-1" }, error: null },
    ]);
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

  it("returns 404 when the code matches no household", async () => {
    supa.queueResult({ data: null, error: { message: "no rows" } });
    const res = await POST(request({ code: "OLIVE-4821" }));
    expect(res.status).toBe(404);
  });
});
