import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { POST } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, calledWith, type SupabaseMock } from "@/test/supabase-mock";

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

function request(body: unknown): NextRequest {
  return new NextRequest("https://test.local/api/recipes/copy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function sourceRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: "recipe-src",
    household_id: "household-other",
    title: "Tarte aux pommes",
    ingredients: "Pommes\nPâte",
    steps: "Étaler\nGarnir\nCuire",
    photo_url: null,
    generated_image_url: null,
    prep_time: "10-20 min",
    cook_time: "30-60 min",
    cost: "€",
    complexity: "facile",
    seasons: ["automne"],
    image_prompt: "An apple pie",
    recipe_tags: [{ tag_id: "tag-1" }],
    ...overrides,
  };
}

describe("POST /api/recipes/copy", () => {
  it("returns 401 without a session", async () => {
    mockHeaders.mockResolvedValue(new Headers());
    const res = await POST(request({ token: "abc" }));
    expect(res.status).toBe(401);
  });

  it("returns 422 when the token is missing", async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(422);
  });

  it("returns 404 when no recipe matches the token", async () => {
    supa.queueResult({ data: null, error: { message: "no rows" } });
    const res = await POST(request({ token: "unknown" }));
    expect(res.status).toBe(404);
  });

  it("does not copy a recipe the household already owns", async () => {
    supa.queueResult({
      data: sourceRecipe({ household_id: "household-1" }),
      error: null,
    });
    const res = await POST(request({ token: "abc" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      recipeId: "recipe-src",
      alreadyOwned: true,
    });
    // Only the lookup chain ran — nothing was inserted.
    expect(calledWith(supa, "recipes", "insert")).toBe(false);
  });

  it("copies the recipe with its metadata and tags into the caller's household", async () => {
    supa.queueResults([
      { data: sourceRecipe(), error: null }, // source lookup
      { data: { id: "recipe-new" }, error: null }, // insert copy
      { data: null, error: null }, // recipe_tags insert
    ]);

    const res = await POST(request({ token: "abc" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, recipeId: "recipe-new" });

    expect(
      calledWith(supa, "recipes", "insert", {
        title: "Tarte aux pommes",
        ingredients: "Pommes\nPâte",
        steps: "Étaler\nGarnir\nCuire",
        prep_time: "10-20 min",
        cook_time: "30-60 min",
        cost: "€",
        complexity: "facile",
        seasons: ["automne"],
        image_prompt: "An apple pie",
        household_id: "household-1",
        source: "shared",
        created_by_device_id: "session-1",
        enrichment_status: "done",
        image_status: "done",
      }),
    ).toBe(true);

    expect(
      calledWith(supa, "recipe_tags", "insert", [
        { recipe_id: "recipe-new", tag_id: "tag-1" },
      ]),
    ).toBe(true);
  });

  it("returns a generic 500 when the insert fails", async () => {
    supa.queueResults([
      { data: sourceRecipe(), error: null },
      { data: null, error: new Error("insert failed") },
    ]);
    const res = await POST(request({ token: "abc" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur serveur" });
  });
});
