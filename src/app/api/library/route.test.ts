import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { headers } from "next/headers";
import { GET } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import { recipeDbRow, tagDbRow } from "@/test/fixtures";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));
// L'auth reste pilotée par les headers mockés (cf. owner-context-mock.ts)
vi.mock("@/lib/auth/owner-context", async () => {
  const { ownerContextFromTestHeaders } = await import("@/test/owner-context-mock");
  return { getOwnerContext: vi.fn(ownerContextFromTestHeaders) };
});

const mockHeaders = headers as unknown as Mock;

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  mockHeaders.mockResolvedValue(new Headers({ "x-household-id": "household-1" }));
});

function request(): NextRequest {
  return new NextRequest("https://test.local/api/library");
}

describe("GET /api/library", () => {
  it("returns 401 without a session", async () => {
    mockHeaders.mockResolvedValue(new Headers());
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it("returns recipes with library metadata and the tag list", async () => {
    supa.queueResults([
      {
        data: [
          recipeDbRow({
            prep_time: "20-30 min",
            cook_time: "> 2h",
            cost: "€€",
            seasons: ["hiver"],
          }),
        ],
        error: null,
      },
      { data: [tagDbRow()], error: null },
    ]);

    const res = await GET(request());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.recipes).toHaveLength(1);
    expect(body.recipes[0].title).toBe("Bœuf bourguignon");
    expect(body.recipes[0].prepTime).toBe("20-30 min");
    expect(body.recipes[0].cookTime).toBe("> 2h");
    expect(body.recipes[0].cost).toBe("€€");
    expect(body.recipes[0].seasons).toEqual(["hiver"]);

    expect(body.tags).toEqual([
      { id: "tag-1", name: "Végétarien", category: "Régime alimentaire" },
    ]);
  });

  it("returns empty arrays when the household has no recipes", async () => {
    supa.queueResults([
      { data: [], error: null },
      { data: [], error: null },
    ]);
    const res = await GET(request());
    const body = await res.json();
    expect(body.recipes).toEqual([]);
    expect(body.tags).toEqual([]);
  });

  it("returns a generic 500 when the recipes query fails", async () => {
    supa.queueResults([
      { data: null, error: new Error("db down") },
      { data: [], error: null },
    ]);
    const res = await GET(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur serveur" });
  });
});
