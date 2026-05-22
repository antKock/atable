import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { DELETE, PUT } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockHeaders = headers as unknown as Mock;

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  mockHeaders.mockResolvedValue(
    new Headers({ "x-household-id": "household-1", "x-session-id": "session-1" }),
  );
});

const ctx = (id = "household-1") => ({ params: Promise.resolve({ id }) });

function deleteRequest(action?: string): NextRequest {
  const url = action
    ? `https://test.local/api/households/household-1?action=${action}`
    : "https://test.local/api/households/household-1";
  return new NextRequest(url, { method: "DELETE" });
}

function putRequest(body: unknown): NextRequest {
  return new NextRequest("https://test.local/api/households/household-1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("DELETE /api/households/[id] (Fix 1.4)", () => {
  it("action=leave removes only the device session", async () => {
    supa.queueResult({ error: null });
    const res = await DELETE(deleteRequest("leave"), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirect: "/" });
    expect(supa.calls.some((c) => c.table === "device_sessions")).toBe(true);
    expect(supa.calls.some((c) => c.table === "households")).toBe(false);
  });

  it("action=delete removes recipes and the household", async () => {
    supa.queueResults([{ error: null }, { error: null }]);
    const res = await DELETE(deleteRequest("delete"), ctx());
    expect(res.status).toBe(200);
    expect(supa.calls.some((c) => c.table === "recipes")).toBe(true);
    expect(supa.calls.some((c) => c.table === "households")).toBe(true);
  });

  it("clears the session cookie", async () => {
    supa.queueResult({ error: null });
    const res = await DELETE(deleteRequest("leave"), ctx());
    expect(res.cookies.get("atable_session")?.value).toBe("");
  });

  it("rejects a missing action with 400", async () => {
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(400);
  });

  it("rejects an unknown action with 400", async () => {
    const res = await DELETE(deleteRequest("nuke"), ctx());
    expect(res.status).toBe(400);
  });

  it("returns 403 when the id does not match the session household", async () => {
    const res = await DELETE(deleteRequest("leave"), ctx("someone-else"));
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/households/[id]", () => {
  it("renames the household", async () => {
    supa.queueResult({
      data: { id: "household-1", name: "Nouveau nom" },
      error: null,
    });
    const res = await PUT(putRequest({ name: "Nouveau nom" }), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "household-1", name: "Nouveau nom" });
  });

  it("rejects an empty name with 400", async () => {
    const res = await PUT(putRequest({ name: "" }), ctx());
    expect(res.status).toBe(400);
  });

  it("returns 403 when the id does not match the session household", async () => {
    const res = await PUT(putRequest({ name: "X" }), ctx("someone-else"));
    expect(res.status).toBe(403);
  });
});
