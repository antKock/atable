import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { GET, PUT, DELETE } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import { recipeDbRow } from "@/test/fixtures";

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));
// L'auth reste pilotée par les headers mockés (cf. owner-context-mock.ts)
vi.mock("@/lib/auth/owner-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/owner-context")>();
  const { ownerContextFromTestHeaders } = await import("@/test/owner-context-mock");
  return { ...actual, getOwnerContext: vi.fn(ownerContextFromTestHeaders) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/lib/enrichment", () => ({
  enrichRecipe: vi.fn(),
  regenerateImage: vi.fn(),
}));

const mockHeaders = headers as unknown as Mock;

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  mockHeaders.mockResolvedValue(new Headers({ "x-household-id": "household-1" }));
});

const ctx = (id = "recipe-1") => ({ params: Promise.resolve({ id }) });

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest("https://test.local/api/recipes/recipe-1", {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/recipes/[id]", () => {
  it("returns the recipe", async () => {
    supa.queueResult({ data: recipeDbRow(), error: null });
    const res = await GET(req("GET"), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("recipe-1");
  });

  it("returns 404 when the recipe is not found", async () => {
    supa.queueResult({ data: null, error: { message: "no rows" } });
    const res = await GET(req("GET"), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 401 without a household header", async () => {
    mockHeaders.mockResolvedValue(new Headers());
    const res = await GET(req("GET"), ctx());
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/recipes/[id]", () => {
  it("updates an existing recipe", async () => {
    supa.queueResults([
      { data: { id: "recipe-1", title: "Old", ingredients: null, steps: null, household_id: "household-1" } },
      { data: recipeDbRow({ title: "Nouveau titre" }), error: null },
    ]);
    const res = await PUT(req("PUT", { title: "Nouveau titre" }), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("Nouveau titre");
  });

  it("returns 404 when the recipe does not exist", async () => {
    supa.queueResult({ data: null });
    const res = await PUT(req("PUT", { title: "X" }), ctx());
    expect(res.status).toBe(404);
  });

  it("rejects an empty title with 422", async () => {
    const res = await PUT(req("PUT", { title: "" }), ctx());
    expect(res.status).toBe(422);
  });
});

describe("DELETE /api/recipes/[id]", () => {
  it("deletes a recipe and returns 204", async () => {
    supa.queueResults([
      { data: { id: "recipe-1", household_id: "household-1" } },
      { error: null },
    ]);
    const res = await DELETE(req("DELETE"), ctx());
    expect(res.status).toBe(204);
  });

  it("returns 404 when the recipe does not exist", async () => {
    supa.queueResult({ data: null });
    const res = await DELETE(req("DELETE"), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 401 without a household header", async () => {
    mockHeaders.mockResolvedValue(new Headers());
    const res = await DELETE(req("DELETE"), ctx());
    expect(res.status).toBe(401);
  });
});
