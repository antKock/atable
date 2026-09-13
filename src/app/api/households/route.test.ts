import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { attachNewHouseholdToOwner, provisionOwnerWithHousehold } from "@/lib/db/onboarding";
import { resolveSessionOwnerFromCookie } from "@/lib/auth/session-owner";
import { resolveDemoTrialStart } from "@/lib/queries/demo-conversion";
import { enforceHouseholdCreateQuota } from "@/lib/import-quota";
import type { OwnerContext } from "@/lib/auth/owner-context";

// Route « créer un carnet » sur des mocks de FONCTIONS db/* (lot 5) : les
// sagas elles-mêmes (ordre des écritures, compensations) sont couvertes par
// src/lib/db/onboarding.test.ts avec le mock FIFO.
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn(() => ({})) }));
vi.mock("@/lib/db/onboarding", () => ({
  attachNewHouseholdToOwner: vi.fn(),
  provisionOwnerWithHousehold: vi.fn(),
}));
vi.mock("@/lib/auth/session-owner", () => ({ resolveSessionOwnerFromCookie: vi.fn() }));
vi.mock("@/lib/queries/demo-conversion", () => ({ resolveDemoTrialStart: vi.fn() }));
vi.mock("@/lib/import-quota", () => ({ enforceHouseholdCreateQuota: vi.fn() }));

const owner = (overrides: Partial<OwnerContext> = {}): OwnerContext => ({
  ownerId: "owner-real",
  ownerName: null,
  ownerAlias: null,
  recoveryEmail: null,
  sessionId: "sid-real",
  memberships: [{ householdId: "hh-a", role: "member", isDemo: false }],
  ...overrides,
});

function request(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://test.local/api/households", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(enforceHouseholdCreateQuota).mockResolvedValue(null);
  vi.mocked(resolveSessionOwnerFromCookie).mockResolvedValue(null);
  vi.mocked(resolveDemoTrialStart).mockResolvedValue(null);
  vi.mocked(provisionOwnerWithHousehold).mockResolvedValue({
    ownerId: "owner-1",
    householdId: "hh-1",
    sessionId: "session-1",
  });
  vi.mocked(attachNewHouseholdToOwner).mockResolvedValue({ householdId: "hh-2" });
});

describe("POST /api/households", () => {
  it("413 avant le quota et toute écriture", async () => {
    const res = await POST(
      new NextRequest("https://test.local/api/households", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": String(2 * 1024 * 1024) },
      }),
    );
    expect(res.status).toBe(413);
    expect(enforceHouseholdCreateQuota).not.toHaveBeenCalled();
  });

  it("429 quand le quota par IP est épuisé, sans écriture", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(enforceHouseholdCreateQuota).mockResolvedValueOnce(
      NextResponse.json({ error: "quota" }, { status: 429 }),
    );
    expect((await POST(request({ name: "Chez nous" }))).status).toBe(429);
    expect(provisionOwnerWithHousehold).not.toHaveBeenCalled();
  });

  it("appareil neuf : saga owner neuf + foyer neuf, cookie posé, redirect /home (200, pas 303)", async () => {
    const res = await POST(request({ name: "Chez nous" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirect: "/home" });
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get("atable_session")?.value).toBeTruthy();
    const [, input] = vi.mocked(provisionOwnerWithHousehold).mock.calls[0];
    expect(input.household).toMatchObject({ kind: "create", name: "Chez nous", origin: "landing" });
    expect(input.role).toBe("member");
    expect(input.owner.id).toBeTruthy();
    expect(input.owner.alias).toBeTruthy();
    expect(input.owner.demoTrialStartedAt).toBeNull();
    const h = input.household as { joinCode: string; guestJoinCode: string };
    expect(h.joinCode).toMatch(/^[A-Z]+-\d{4}$/);
    expect(h.guestJoinCode).not.toBe(h.joinCode);
  });

  it("nom omis ou vide → nom par défaut de la locale (spec #23)", async () => {
    await POST(request({}));
    await POST(request({ name: "   " }));
    for (const [, input] of vi.mocked(provisionOwnerWithHousehold).mock.calls) {
      expect((input.household as { name: string }).name).toBe("Mon carnet");
    }
  });

  it("nom > 50 caractères → 422", async () => {
    expect((await POST(request({ name: "x".repeat(51) }))).status).toBe(422);
    expect(provisionOwnerWithHousehold).not.toHaveBeenCalled();
  });

  it("sortie de démo : origine demo_conversion + marqueur de conversion sur l'owner neuf", async () => {
    vi.mocked(resolveSessionOwnerFromCookie).mockResolvedValue(
      owner({
        ownerId: "owner-demo",
        memberships: [{ householdId: "demo", role: "member", isDemo: true }],
      }),
    );
    vi.mocked(resolveDemoTrialStart).mockResolvedValue("2026-09-01T10:00:00Z");
    const res = await POST(request({}));
    expect(res.status).toBe(200);
    const [, input] = vi.mocked(provisionOwnerWithHousehold).mock.calls[0];
    expect(input.owner.demoTrialStartedAt).toBe("2026-09-01T10:00:00Z");
    expect((input.household as { origin: string }).origin).toBe("demo_conversion");
    expect(attachNewHouseholdToOwner).not.toHaveBeenCalled();
  });

  it("session réelle : création ADDITIVE (foyer + membership sur l'owner existant), pas de cookie", async () => {
    vi.mocked(resolveSessionOwnerFromCookie).mockResolvedValue(owner());
    const res = await POST(request({ name: "Second carnet" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirect: "/home", added: true });
    expect(res.cookies.get("atable_session")).toBeUndefined();
    expect(attachNewHouseholdToOwner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ownerId: "owner-real", name: "Second carnet" }),
    );
    expect(provisionOwnerWithHousehold).not.toHaveBeenCalled();
  });

  it("échec de la saga → 500 générique (message brut jamais exposé)", async () => {
    vi.mocked(provisionOwnerWithHousehold).mockRejectedValue(
      new Error('duplicate key value violates unique constraint "households_join_code_key"'),
    );
    const res = await POST(request({ name: "Chez nous" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur serveur" });
  });
});
