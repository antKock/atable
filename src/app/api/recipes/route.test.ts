import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { GET, POST } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import { recipeDbRow } from "@/test/fixtures";

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));
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

function getRequest(): NextRequest {
  return new NextRequest("https://test.local/api/recipes");
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest("https://test.local/api/recipes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/recipes", () => {
  it("returns the household's recipes", async () => {
    supa.queueResult({ data: [recipeDbRow()], error: null });
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Bœuf bourguignon");
  });

  it("returns 401 without a household header", async () => {
    mockHeaders.mockResolvedValue(new Headers());
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("returns 500 when the query errors", async () => {
    supa.queueResult({ data: null, error: { message: "query failed" } });
    const res = await GET(getRequest());
    expect(res.status).toBe(500);
  });
});

describe("POST /api/recipes", () => {
  it("creates a recipe and returns 201", async () => {
    supa.queueResult({ data: recipeDbRow(), error: null });
    const res = await POST(postRequest({ title: "Tarte" }));
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe("recipe-1");
  });

  it("rejects an empty title with 422", async () => {
    const res = await POST(postRequest({ title: "" }));
    expect(res.status).toBe(422);
  });

  it("returns 401 without a household header", async () => {
    mockHeaders.mockResolvedValue(new Headers());
    const res = await POST(postRequest({ title: "Tarte" }));
    expect(res.status).toBe(401);
  });
});
