import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { GET, POST } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, calledWith, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const mockHeaders = headers as unknown as Mock;

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  mockHeaders.mockResolvedValue(new Headers({ "x-household-id": "household-1" }));
});

function getRequest(): NextRequest {
  return new NextRequest("https://test.local/api/tags");
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest("https://test.local/api/tags", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/tags", () => {
  it("returns 401 without a session", async () => {
    mockHeaders.mockResolvedValue(new Headers());
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("returns predefined and household tags", async () => {
    supa.queueResult({
      data: [
        { id: "tag-1", name: "Végétarien", category: "Régime alimentaire" },
        { id: "tag-2", name: "Perso", category: null },
      ],
      error: null,
    });
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tags).toHaveLength(2);
  });

  it("scopes the query to predefined OR household-owned tags", async () => {
    supa.queueResult({ data: [], error: null });
    await GET(getRequest());
    expect(
      calledWith(supa, "tags", "or", "household_id.is.null,household_id.eq.household-1"),
    ).toBe(true);
  });
});

describe("POST /api/tags", () => {
  it("returns 401 without a session", async () => {
    mockHeaders.mockResolvedValue(new Headers());
    const res = await POST(postRequest({ name: "Festif" }));
    expect(res.status).toBe(401);
  });

  it("rejects an empty name with 422", async () => {
    const res = await POST(postRequest({ name: "" }));
    expect(res.status).toBe(422);
  });

  it("rejects a name over 50 characters with 422", async () => {
    const res = await POST(postRequest({ name: "x".repeat(51) }));
    expect(res.status).toBe(422);
  });

  it("returns the existing tag instead of duplicating (case-insensitive)", async () => {
    const existing = { id: "tag-1", name: "Festif", category: null };
    supa.queueResult({ data: existing, error: null });
    const res = await POST(postRequest({ name: "festif" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(existing);
    expect(calledWith(supa, "tags", "ilike", "name", "festif")).toBe(true);
  });

  it("creates a household-scoped custom tag with 201", async () => {
    supa.queueResults([
      { data: null, error: { message: "no rows" } }, // dedup lookup: no match
      { data: { id: "tag-9", name: "Festif", category: null }, error: null },
    ]);
    const res = await POST(postRequest({ name: "Festif" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "tag-9", name: "Festif", category: null });
    expect(
      calledWith(supa, "tags", "insert", {
        name: "Festif",
        is_predefined: false,
        household_id: "household-1",
        category: null,
      }),
    ).toBe(true);
  });

  it("returns a generic 500 when the insert fails", async () => {
    supa.queueResults([
      { data: null, error: { message: "no rows" } },
      { data: null, error: new Error("insert failed") },
    ]);
    const res = await POST(postRequest({ name: "Festif" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur serveur" });
  });
});
