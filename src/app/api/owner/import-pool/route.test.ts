import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { PUT } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, calledWith, type SupabaseMock } from "@/test/supabase-mock";
import { deleteOwnerImportSamples } from "@/lib/import-pool/samples";

// Refus (ou retour) de la conservation 30 jours des envois d'import.
vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/auth/owner-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/owner-context")>();
  const { ownerContextFromTestHeaders } = await import("@/test/owner-context-mock");
  return { ...actual, getOwnerContext: vi.fn(ownerContextFromTestHeaders) };
});
vi.mock("@/lib/import-pool/samples", () => ({ deleteOwnerImportSamples: vi.fn(async () => 2) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

let supa: SupabaseMock;
beforeEach(() => {
  vi.clearAllMocks();
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  (headers as unknown as Mock).mockResolvedValue(new Headers({ "x-household-id": "hh-1" }));
});

const put = (body: unknown) =>
  PUT(
    new NextRequest("https://test.local/api/owner/import-pool", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("PUT /api/owner/import-pool", () => {
  it("refus : enregistré ET ce qui a été gardé est supprimé tout de suite", async () => {
    supa.queueResult({ error: null });
    const res = await put({ optOut: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ optOut: true });
    expect(calledWith(supa, "owners", "update", { import_pool_opt_out: true })).toBe(true);
    expect(calledWith(supa, "owners", "eq", "id", "owner-test")).toBe(true);
    expect(deleteOwnerImportSamples).toHaveBeenCalledWith("owner-test");
  });

  it("retour : enregistré, rien à supprimer", async () => {
    supa.queueResult({ error: null });
    await put({ optOut: false });
    expect(calledWith(supa, "owners", "update", { import_pool_opt_out: false })).toBe(true);
    expect(deleteOwnerImportSamples).not.toHaveBeenCalled();
  });

  it("un échec de la suppression n'annule pas le refus (la purge nocturne rattrape)", async () => {
    supa.queueResult({ error: null });
    vi.mocked(deleteOwnerImportSamples).mockRejectedValueOnce(new Error("s3 down"));
    const res = await put({ optOut: true });
    expect(res.status).toBe(200);
  });

  it("corps invalide → 422, rien n'est écrit", async () => {
    const res = await put({ optOut: "oui" });
    expect(res.status).toBe(422);
    expect(supa.calls).toHaveLength(0);
  });
});
