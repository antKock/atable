import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest, NextResponse, after } from "next/server";
import { headers } from "next/headers";
import { GET, POST } from "./route";
import { enrichRecipe } from "@/lib/enrichment";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, findCall, calledWith, type SupabaseMock } from "@/test/supabase-mock";
import { recipeDbRow } from "@/test/fixtures";

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));
// L'auth reste pilotée par les headers mockés (cf. owner-context-mock.ts)
vi.mock("@/lib/auth/owner-context", async () => {
  const { ownerContextFromTestHeaders } = await import("@/test/owner-context-mock");
  return { getOwnerContext: vi.fn(ownerContextFromTestHeaders) };
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
vi.mock("@/lib/import-quota", () => ({
  enforceRecipeCreateQuota: vi.fn().mockResolvedValue(null),
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

  it("records the add-method source on the inserted recipe", async () => {
    supa.queueResult({ data: recipeDbRow(), error: null });
    await POST(postRequest({ title: "Tarte", source: "url" }));
    const insert = findCall(supa, "recipes")?.ops.find((o) => o.method === "insert");
    expect((insert?.args[0] as { source?: string }).source).toBe("url");
  });

  it("records the creating device from the session header", async () => {
    mockHeaders.mockResolvedValue(
      new Headers({ "x-household-id": "household-1", "x-session-id": "session-9" }),
    );
    supa.queueResult({ data: recipeDbRow(), error: null });
    await POST(postRequest({ title: "Tarte" }));
    const insert = findCall(supa, "recipes")?.ops.find((o) => o.method === "insert");
    expect((insert?.args[0] as { created_by_device_id?: string }).created_by_device_id).toBe(
      "session-9",
    );
  });

  it("defaults source to 'manual' when omitted", async () => {
    supa.queueResult({ data: recipeDbRow(), error: null });
    await POST(postRequest({ title: "Tarte" }));
    const insert = findCall(supa, "recipes")?.ops.find((o) => o.method === "insert");
    expect((insert?.args[0] as { source?: string }).source).toBe("manual");
  });

  it("rejects an invalid source with 422", async () => {
    const res = await POST(postRequest({ title: "Tarte", source: "telepathy" }));
    expect(res.status).toBe(422);
  });

  it("tells enrichment to skip image generation when a user photo is incoming", async () => {
    vi.mocked(enrichRecipe).mockClear();
    vi.mocked(after).mockImplementation(((fn: () => unknown) => void fn()) as never);
    supa.queueResult({ data: recipeDbRow(), error: null });
    await POST(postRequest({ title: "Tarte", willUploadPhoto: true }));
    expect(enrichRecipe).toHaveBeenCalledWith("recipe-1", { skipImage: true });
  });

  it("lets enrichment generate an image when no user photo is incoming", async () => {
    vi.mocked(enrichRecipe).mockClear();
    vi.mocked(after).mockImplementation(((fn: () => unknown) => void fn()) as never);
    supa.queueResult({ data: recipeDbRow(), error: null });
    await POST(postRequest({ title: "Tarte" }));
    expect(enrichRecipe).toHaveBeenCalledWith("recipe-1", { skipImage: undefined });
  });

  it("returns 401 without a household header", async () => {
    mockHeaders.mockResolvedValue(new Headers());
    const res = await POST(postRequest({ title: "Tarte" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when the recipe-creation quota is exhausted", async () => {
    const { enforceRecipeCreateQuota } = await import("@/lib/import-quota");
    vi.mocked(enforceRecipeCreateQuota).mockResolvedValueOnce(
      NextResponse.json({ error: "quota" }, { status: 429 }),
    );
    const res = await POST(postRequest({ title: "Tarte" }));
    expect(res.status).toBe(429);
    expect(findCall(supa, "recipes")).toBeUndefined();
  });
});

describe("GET /api/recipes — filters", () => {
  function filteredRequest(qs: string): NextRequest {
    return new NextRequest(`https://test.local/api/recipes?${qs}`);
  }

  it("filters by tag ids with an inner join", async () => {
    supa.queueResult({ data: [], error: null });
    await GET(filteredRequest("tags=tag-1,tag-2"));
    const ops = findCall(supa, "recipes")!.ops;
    const select = ops.find((o) => o.method === "select");
    expect(String(select!.args[0])).toContain("recipe_tags!inner");
    expect(calledWith(supa, "recipes", "in", "recipe_tags.tag_id", ["tag-1", "tag-2"])).toBe(true);
  });

  it("filters by season with an array containment", async () => {
    supa.queueResult({ data: [], error: null });
    await GET(filteredRequest("season=hiver"));
    expect(calledWith(supa, "recipes", "contains", "seasons", ["hiver"])).toBe(true);
  });

  it("filters by cost with an equality", async () => {
    supa.queueResult({ data: [], error: null });
    await GET(filteredRequest("cost=%E2%82%AC%E2%82%AC"));
    expect(calledWith(supa, "recipes", "eq", "cost", "€€")).toBe(true);
  });

  it("applies no filter ops without query params", async () => {
    supa.queueResult({ data: [], error: null });
    await GET(getRequest());
    const ops = findCall(supa, "recipes")!.ops.map((o) => o.method);
    expect(ops).not.toContain("in");
    expect(ops).not.toContain("contains");
    expect(ops.filter((m) => m === "eq")).toHaveLength(1); // household_id only
  });

  it("always orders by created_at descending", async () => {
    supa.queueResult({ data: [], error: null });
    await GET(getRequest());
    expect(calledWith(supa, "recipes", "order", "created_at", { ascending: false })).toBe(true);
  });
});
