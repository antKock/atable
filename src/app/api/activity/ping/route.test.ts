import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { POST } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, findCall, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));
// L'auth reste pilotée par les headers mockés (cf. owner-context-mock.ts)
vi.mock("@/lib/auth/owner-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/owner-context")>();
  const { ownerContextFromTestHeaders } = await import("@/test/owner-context-mock");
  return { ...actual, getOwnerContext: vi.fn(ownerContextFromTestHeaders) };
});

const mockHeaders = headers as unknown as Mock;

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  mockHeaders.mockResolvedValue(
    new Headers({ "x-household-id": "household-1", "x-session-id": "session-1" }),
  );
});

function postRequest(body?: unknown): NextRequest {
  return new NextRequest("https://test.local/api/activity/ping", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** First arg of the upsert/insert op on a recorded table chain. */
function payloadOf(table: string, method: string): Record<string, unknown> {
  const call = findCall(supa, table);
  const op = call?.ops.find((o) => o.method === method);
  return op?.args[0] as Record<string, unknown>;
}

describe("POST /api/activity/ping", () => {
  it("records today's activity and returns ok", async () => {
    const res = await POST(postRequest({ platform: "web" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const activity = payloadOf("daily_activity", "upsert");
    expect(activity).toMatchObject({
      household_id: "household-1",
      device_id: "session-1",
      platform: "web",
      origin: "ping",
    });
    expect(activity.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // session heartbeat refreshed
    expect(payloadOf("device_sessions", "update")).toMatchObject({ platform: "web" });
  });

  it("records the app version when provided", async () => {
    await POST(postRequest({ platform: "ios", appVersion: "55adf8d6456da1d13a647e6884e6acfb504e1d3f" }));
    expect(payloadOf("daily_activity", "upsert").app_version).toBe(
      "55adf8d6456da1d13a647e6884e6acfb504e1d3f",
    );
  });

  it("stores null app_version when absent, and ignores an over-long value", async () => {
    await POST(postRequest({ platform: "web" }));
    expect(payloadOf("daily_activity", "upsert").app_version).toBeNull();

    await POST(postRequest({ platform: "web", appVersion: "x".repeat(65) }));
    expect(payloadOf("daily_activity", "upsert").app_version).toBeNull();
  });

  it("falls back to 'unknown' for an unrecognised platform", async () => {
    await POST(postRequest({ platform: "windows-phone" }));
    expect(payloadOf("daily_activity", "upsert").platform).toBe("unknown");
  });

  it("falls back to 'unknown' when the body is missing", async () => {
    await POST(postRequest());
    expect(payloadOf("daily_activity", "upsert").platform).toBe("unknown");
  });

  it("returns 401 without auth headers", async () => {
    mockHeaders.mockResolvedValue(new Headers());
    const res = await POST(postRequest({ platform: "web" }));
    expect(res.status).toBe(401);
  });
});
