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

describe("POST /api/demo/session (Fix 1.2)", () => {
  it("creates a session and returns 200 JSON with a redirect", async () => {
    supa.queueResult({ data: { id: "session-1" }, error: null });
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirect: "/home" });
  });

  it("sets the atable_session cookie on the JSON response", async () => {
    supa.queueResult({ data: { id: "session-1" }, error: null });
    const res = await POST(request());
    const cookie = res.cookies.get("atable_session");
    expect(cookie?.value).toBeTruthy();
    expect(cookie!.value.length).toBeGreaterThan(10);
  });

  it("does NOT issue a 303 redirect (regression guard)", async () => {
    supa.queueResult({ data: { id: "session-1" }, error: null });
    const res = await POST(request());
    expect(res.status).not.toBe(303);
    expect(res.headers.get("location")).toBeNull();
  });

  it("returns 500 when the session insert fails", async () => {
    supa.queueResult({ data: null, error: { message: "insert failed" } });
    const res = await POST(request());
    expect(res.status).toBe(500);
  });
});
