import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { GET, PUT, DELETE } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import { recipeDbRow } from "@/test/fixtures";
import { purgeRecipePhotos } from "@/lib/storage/photos";

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
// Purge du stockage : doublée ici (le calcul des chemins est couvert par
// photos.test.ts) — on vérifie que DELETE la déclenche avec la ligne lue.
vi.mock("@/lib/storage/photos", () => ({ purgeRecipePhotos: vi.fn() }));

const mockHeaders = headers as unknown as Mock;

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  vi.mocked(purgeRecipePhotos).mockReset().mockResolvedValue(0);
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
  const LEGACY = "https://x.supabase.co/storage/v1/object/public/recipe-photos";

  it("deletes a recipe and returns 204", async () => {
    supa.queueResults([
      { data: { id: "recipe-1", household_id: "household-1" } },
      { error: null },
    ]);
    const res = await DELETE(req("DELETE"), ctx());
    expect(res.status).toBe(204);
  });

  it("purge la photo et l'image générée du stockage après la suppression (revue 2026-09-12)", async () => {
    const row = {
      id: "recipe-1",
      household_id: "household-1",
      photo_url: `${LEGACY}/household-1/recipe-1/photo.webp?v=2`,
      generated_image_url: `${LEGACY}/generated/recipe-1/ai-image.webp`,
    };
    supa.queueResults([{ data: row }, { error: null }]);
    const res = await DELETE(req("DELETE"), ctx());
    expect(res.status).toBe(204);
    expect(purgeRecipePhotos).toHaveBeenCalledWith([row]);
    // La purge vient APRÈS la suppression de la ligne (la lecture sélectionne
    // bien les deux colonnes photo).
    const select = supa.calls[0].ops.find((op) => op.method === "select")!.args[0] as string;
    expect(select).toContain("photo_url");
    expect(select).toContain("generated_image_url");
  });

  it("répond 204 même si la purge du stockage échoue (la ligne est déjà partie)", async () => {
    supa.queueResults([
      { data: { id: "recipe-1", household_id: "household-1", photo_url: `${LEGACY}/h/r/photo.webp` } },
      { error: null },
    ]);
    vi.mocked(purgeRecipePhotos).mockRejectedValueOnce(new Error("s3 down"));
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
