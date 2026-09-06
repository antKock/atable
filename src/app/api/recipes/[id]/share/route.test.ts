import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { POST } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import { t as fr } from "@/lib/i18n/fr";

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));
// L'auth reste pilotée par les headers mockés (cf. owner-context-mock.ts)
vi.mock("@/lib/auth/owner-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/owner-context")>();
  const { ownerContextFromTestHeaders } = await import("@/test/owner-context-mock");
  return { ...actual, getOwnerContext: vi.fn(ownerContextFromTestHeaders) };
});
// Locale de l'appareil émetteur pilotée par le test (hors contexte de requête,
// la vraie getLocale() replierait toujours sur fr).
vi.mock("@/lib/i18n/server", () => ({
  getLocale: vi.fn(async () => "fr"),
  getT: vi.fn(async () => fr),
}));

const mockHeaders = headers as unknown as Mock;

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  vi.mocked(getLocale).mockResolvedValue("fr");
  mockHeaders.mockResolvedValue(new Headers({ "x-household-id": "household-1" }));
});

const ctx = (id = "recipe-1") => ({ params: Promise.resolve({ id }) });

function req(): NextRequest {
  return new NextRequest("https://test.local/api/recipes/recipe-1/share", { method: "POST" });
}

describe("POST /api/recipes/[id]/share", () => {
  it("renvoie l'URL nue pour un appareil FR (jeton déjà émis)", async () => {
    supa.queueResult({
      data: { id: "recipe-1", share_token: "tok123", household_id: "household-1" },
    });
    const res = await POST(req(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "tok123", url: "https://test.local/r/tok123" });
  });

  it("ajoute l'indice ?l=en pour un appareil EN (aperçu OG dans sa langue)", async () => {
    vi.mocked(getLocale).mockResolvedValue("en");
    supa.queueResult({
      data: { id: "recipe-1", share_token: "tok123", household_id: "household-1" },
    });
    const res = await POST(req(), ctx());
    expect((await res.json()).url).toBe("https://test.local/r/tok123?l=en");
  });

  it("émet un jeton quand la recette n'en a pas encore", async () => {
    supa.queueResults([
      { data: { id: "recipe-1", share_token: null, household_id: "household-1" } },
      { data: { share_token: "fresh" } }, // update … is(share_token, null)
    ]);
    const res = await POST(req(), ctx());
    const body = await res.json();
    expect(body.token).toBe("fresh");
    expect(body.url).toBe("https://test.local/r/fresh");
  });

  it("404 si la recette n'est pas dans un foyer de l'owner", async () => {
    supa.queueResult({ data: null, error: { message: "no rows" } });
    const res = await POST(req(), ctx("other"));
    expect(res.status).toBe(404);
  });
});
