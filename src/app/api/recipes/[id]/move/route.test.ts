import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { PATCH } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { getOwnerContext, type OwnerContext } from "@/lib/auth/owner-context";
import { getPhotoStore } from "@/lib/storage/photos";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import { createPhotoStoreMock, type PhotoStoreMock } from "@/test/photo-store-mock";

// Déplacement d'une recette entre foyers (Lot 4) — revue 2026-09-12 : gardes
// dans l'ordre commun 404 → membre (source) → seed démo → membre (destination),
// relocalisation best-effort de la photo foyer-scopée.
vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/auth/owner-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/owner-context")>()),
  getOwnerContext: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/storage/photos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage/photos")>()),
  getPhotoStore: vi.fn(),
}));
vi.mock("@/lib/admin/track-stat", () => ({ trackStat: vi.fn() }));

const LEGACY = "https://x.supabase.co/storage/v1/object/public/recipe-photos";

function owner(overrides: Partial<OwnerContext> = {}): OwnerContext {
  return {
    ownerId: "owner-1",
    ownerName: null,
    ownerAlias: null,
    recoveryEmail: null,
    sessionId: "session-1",
    memberships: [
      { householdId: "hh-a", role: "member", isDemo: false },
      { householdId: "hh-b", role: "member", isDemo: false },
      { householdId: "hh-guest", role: "guest", isDemo: false },
    ],
    ...overrides,
  };
}

let supa: SupabaseMock;
let photos: PhotoStoreMock;

beforeEach(() => {
  vi.clearAllMocks();
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  photos = createPhotoStoreMock();
  vi.mocked(getPhotoStore).mockReturnValue(photos);
  (headers as unknown as Mock).mockResolvedValue(new Headers());
  vi.mocked(getOwnerContext).mockResolvedValue(owner());
});

const ctx = { params: Promise.resolve({ id: "recipe-1" }) };
const req = (body: unknown) =>
  new NextRequest("https://test.local/api/recipes/recipe-1/move", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const recipeRow = (overrides: Record<string, unknown> = {}) => ({
  id: "recipe-1",
  household_id: "hh-a",
  is_seed: false,
  photo_url: null,
  ...overrides,
});

describe("PATCH /api/recipes/[id]/move", () => {
  it("déplace la recette (household_id, updated_at, last_moved_at) sans photo à relocaliser", async () => {
    supa.queueResults([{ data: recipeRow() }, { error: null }]);
    const res = await PATCH(req({ householdId: "hh-b" }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, householdId: "hh-b" });
    const update = supa.calls.find((c) => c.table === "recipes" && c.ops[0].method === "update")!;
    const payload = update.ops[0].args[0] as Record<string, unknown>;
    expect(payload.household_id).toBe("hh-b");
    expect(payload.last_moved_at).toBe(payload.updated_at);
    expect(photos.copy).not.toHaveBeenCalled();
  });

  it("relocalise la photo foyer-scopée : copie AVANT l'update, suppression de la source APRÈS", async () => {
    supa.queueResults([
      { data: recipeRow({ photo_url: `${LEGACY}/hh-a/recipe-1/photo.webp?v=1` }) },
      { error: null },
    ]);
    const res = await PATCH(req({ householdId: "hh-b" }), ctx);
    expect(res.status).toBe(200);
    expect(photos.copy).toHaveBeenCalledWith("hh-a/recipe-1/photo.webp", "hh-b/recipe-1/photo.webp");
    const update = supa.calls.find((c) => c.table === "recipes" && c.ops[0].method === "update")!;
    expect((update.ops[0].args[0] as { photo_url: string }).photo_url).toContain("hh-b/recipe-1/photo.webp");
    expect(photos.remove).toHaveBeenCalledWith(["hh-a/recipe-1/photo.webp"]);
  });

  it("échec de copie : on garde l'URL source (best-effort), pas de suppression", async () => {
    supa.queueResults([
      { data: recipeRow({ photo_url: `${LEGACY}/hh-a/recipe-1/photo.webp` }) },
      { error: null },
    ]);
    photos.copy.mockRejectedValueOnce(new Error("s3"));
    const res = await PATCH(req({ householdId: "hh-b" }), ctx);
    expect(res.status).toBe(200);
    const update = supa.calls.find((c) => c.table === "recipes" && c.ops[0].method === "update")!;
    expect("photo_url" in (update.ops[0].args[0] as object)).toBe(false);
    expect(photos.remove).not.toHaveBeenCalled();
  });

  it("no-op explicite quand la destination est le foyer courant", async () => {
    supa.queueResults([{ data: recipeRow() }]);
    const res = await PATCH(req({ householdId: "hh-a" }), ctx);
    expect(await res.json()).toEqual({ ok: true, householdId: "hh-a" });
    expect(supa.calls.filter((c) => c.ops[0].method === "update")).toHaveLength(0);
  });

  it("422 sans foyer cible ; 404 recette hors des foyers de l'owner", async () => {
    expect((await PATCH(req({}), ctx)).status).toBe(422);
    supa.queueResult({ data: null, error: { message: "no rows" } });
    expect((await PATCH(req({ householdId: "hh-b" }), ctx)).status).toBe(404);
  });

  it("403 : invité sur le foyer source (lecture seule)", async () => {
    supa.queueResults([{ data: recipeRow({ household_id: "hh-guest" }) }]);
    expect((await PATCH(req({ householdId: "hh-a" }), ctx)).status).toBe(403);
  });

  it("403 : destination où l'owner n'est qu'invité (ou inconnue)", async () => {
    supa.queueResults([{ data: recipeRow() }]);
    expect((await PATCH(req({ householdId: "hh-guest" }), ctx)).status).toBe(403);
    supa.queueResults([{ data: recipeRow() }]);
    expect((await PATCH(req({ householdId: "hh-unknown" }), ctx)).status).toBe(403);
  });

  it("403 « monde gelé » : recette seed du foyer démo", async () => {
    vi.mocked(getOwnerContext).mockResolvedValue(
      owner({ memberships: [{ householdId: "demo", role: "member", isDemo: true }, { householdId: "hh-b", role: "member", isDemo: false }] }),
    );
    supa.queueResults([{ data: recipeRow({ household_id: "demo", is_seed: true }) }]);
    expect((await PATCH(req({ householdId: "hh-b" }), ctx)).status).toBe(403);
  });
});
