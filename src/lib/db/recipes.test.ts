import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { loadOwnedRecipe } from "./recipes";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import type { OwnerContext } from "@/lib/auth/owner-context";

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/admin/track-stat", () => ({ trackStat: vi.fn() }));

const owner: OwnerContext = {
  ownerId: "o",
  ownerName: null,
  ownerAlias: null,
  recoveryEmail: null,
  sessionId: "s",
  memberships: [
    { householdId: "hh-member", role: "member", isDemo: false },
    { householdId: "hh-guest", role: "guest", isDemo: false },
    { householdId: "hh-demo", role: "member", isDemo: true },
  ],
};

let supa: SupabaseMock;
beforeEach(() => {
  supa = createSupabaseMock();
});

describe("loadOwnedRecipe", () => {
  it("projette les colonnes de garde + celles demandées, scopé sur TOUS les foyers de l'owner", async () => {
    supa.queueResult({ data: { id: "r", household_id: "hh-guest", is_seed: false, title: "T" } });
    const r = await loadOwnedRecipe(supa.client, "r", owner, { columns: ["title"] });
    expect(r).not.toBeInstanceOf(NextResponse);
    const ops = supa.calls[0].ops;
    expect(ops.find((o) => o.method === "select")!.args[0]).toBe("id, household_id, is_seed, title");
    expect(ops.find((o) => o.method === "in")!.args).toEqual(["household_id", ["hh-member", "hh-guest", "hh-demo"]]);
    expect((r as { recipe: { title: string } }).recipe.title).toBe("T");
  });

  it("`all` + `withTags` → `*` et la jointure tags", async () => {
    supa.queueResult({ data: { id: "r", household_id: "hh-member", is_seed: false, recipe_tags: [] } });
    await loadOwnedRecipe(supa.client, "r", owner, { all: true, withTags: true });
    expect(supa.calls[0].ops.find((o) => o.method === "select")!.args[0]).toBe(
      "*, recipe_tags(tag_id, tags(id, name, category))",
    );
  });

  it("404 localisé quand la recette n'est pas dans un foyer de l'owner", async () => {
    supa.queueResult({ data: null, error: { message: "no rows" } });
    const r = (await loadOwnedRecipe(supa.client, "r", owner)) as NextResponse;
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Recette introuvable" });
  });

  it("lecture : un invité passe ; écriture : 403 pour un invité", async () => {
    supa.queueResult({ data: { id: "r", household_id: "hh-guest", is_seed: false } });
    expect(await loadOwnedRecipe(supa.client, "r", owner)).not.toBeInstanceOf(NextResponse);
    supa.queueResult({ data: { id: "r", household_id: "hh-guest", is_seed: false } });
    expect(((await loadOwnedRecipe(supa.client, "r", owner, { write: true })) as NextResponse).status).toBe(403);
  });

  it("écriture : recette SEED du foyer démo refusée (monde gelé), non-seed libre", async () => {
    supa.queueResult({ data: { id: "r", household_id: "hh-demo", is_seed: true } });
    expect(((await loadOwnedRecipe(supa.client, "r", owner, { write: true })) as NextResponse).status).toBe(403);
    supa.queueResult({ data: { id: "r", household_id: "hh-demo", is_seed: false } });
    expect(await loadOwnedRecipe(supa.client, "r", owner, { write: true })).not.toBeInstanceOf(NextResponse);
  });
});
