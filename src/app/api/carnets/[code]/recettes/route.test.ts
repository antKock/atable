import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");

let supa: SupabaseMock;
const savedEnv = { BIEN_API_SECRET: process.env.BIEN_API_SECRET, APP_ORIGIN: process.env.APP_ORIGIN };

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  process.env.BIEN_API_SECRET = "secret-bien";
  process.env.APP_ORIGIN = "https://mijote.test";
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.restoreAllMocks();
});

const HOUSEHOLD = "22222222-2222-2222-2222-222222222222";

function call(code: string, auth?: string) {
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = auth;
  return GET(new NextRequest(`https://mijote.test/api/carnets/${code}/recettes`, { headers }), {
    params: Promise.resolve({ code }),
  });
}

describe("GET /api/carnets/[code]/recettes", () => {
  it("refuse sans le Bearer, et tout refuse sans secret configuré", async () => {
    expect((await call("YUZU-2250")).status).toBe(401);
    expect((await call("YUZU-2250", "Bearer faux")).status).toBe(401);
    delete process.env.BIEN_API_SECRET;
    expect((await call("YUZU-2250", "Bearer secret-bien")).status).toBe(401);
  });

  it("rejette un code mal formé et un carnet inconnu", async () => {
    expect((await call("pas-un-code", "Bearer secret-bien")).status).toBe(400);
    supa.queueResult({ data: [], error: null });
    expect((await call("YUZU-2250", "Bearer secret-bien")).status).toBe(404);
  });

  it("n'accepte que le code membre, pas le code invité", async () => {
    supa.queueResult({
      data: [{ id: HOUSEHOLD, name: "Bien", join_code: "YUZU-2250", guest_join_code: "KIWI-1111" }],
      error: null,
    });
    expect((await call("KIWI-1111", "Bearer secret-bien")).status).toBe(404);
  });

  it("renvoie les recettes du carnet avec leur lien public, en frappant le jeton manquant", async () => {
    supa.queueResults([
      { data: [{ id: HOUSEHOLD, name: "Bien", join_code: "YUZU-2250", guest_join_code: "KIWI-1111" }], error: null },
      {
        data: [
          {
            id: "r1",
            title: "Chili",
            ingredients: "750 g de bœuf haché\n2 poivrons",
            servings: 4,
            prep_time: "10-20 min",
            cook_time: "< 15 min",
            complexity: "facile",
            photo_url: "https://photos/r1.webp",
            generated_image_url: null,
            share_token: "abc12345",
            updated_at: "2026-09-15T10:00:00Z",
          },
          {
            id: "r2",
            title: "Quiche",
            ingredients: null,
            servings: null,
            prep_time: null,
            cook_time: null,
            complexity: null,
            photo_url: null,
            generated_image_url: "https://photos/r2-ia.webp",
            share_token: null,
            updated_at: null,
          },
        ],
        error: null,
      },
      // Frappe du jeton de r2 : l'update rend le jeton posé.
      { data: { share_token: "nouveau12" }, error: null },
    ]);
    const res = await call("YUZU-2250", "Bearer secret-bien");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.carnet).toEqual({ id: HOUSEHOLD, nom: "Bien" });
    expect(body.recettes).toHaveLength(2);
    expect(body.recettes[0]).toMatchObject({
      id: "r1",
      titre: "Chili",
      parts: 4,
      preparation: "10-20 min",
      cuisson: "< 15 min",
      image: "https://photos/r1.webp",
      lien: "https://mijote.test/r/abc12345",
    });
    expect(body.recettes[1]).toMatchObject({ image: "https://photos/r2-ia.webp", lien: "https://mijote.test/r/nouveau12" });
    // Le mint est borné au foyer et ne touche qu'une recette sans jeton.
    const mint = supa.calls.find((c) => c.ops.some((o) => o.method === "update"));
    expect(mint?.ops.map((o) => o.method)).toEqual(["update", "eq", "eq", "is", "select"]);
  });
});
