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

/** Queue the 3 results a successful create consumes. */
function queueSuccess() {
  supa.queueResults([
    { data: { id: "household-1" }, error: null }, // insert household
    { data: { id: "session-1" }, error: null }, // insert device_session
    { error: null }, // migrate legacy recipes
  ]);
}

describe("POST /api/households (Fix 1.2)", () => {
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
    supa.queueResult({ data: null, error: { message: "insert failed" } });
    const res = await POST(request({ name: "Chez nous" }));
    expect(res.status).toBe(500);
  });
});
