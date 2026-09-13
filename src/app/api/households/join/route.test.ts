import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { POST } from "./route";
import { joinRateLimit, joinCodeRateLimit } from "@/lib/redis";
import { resolveInviteCode } from "@/lib/auth/invite-code";
import { provisionOwnerWithHousehold } from "@/lib/db/onboarding";
import { insertMembership, updateMembershipRole } from "@/lib/db/households";
import { resolveSessionOwnerFromCookie } from "@/lib/auth/session-owner";
import { resolveDemoTrialStart } from "@/lib/queries/demo-conversion";
import type { OwnerContext } from "@/lib/auth/owner-context";

// Route « rejoindre » sur des mocks de fonctions db/* (lot 5).
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn(() => ({})) }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/redis", () => ({
  joinRateLimit: { limit: vi.fn() },
  joinCodeRateLimit: { limit: vi.fn() },
}));
vi.mock("@/lib/auth/invite-code", () => ({ resolveInviteCode: vi.fn() }));
vi.mock("@/lib/db/onboarding", () => ({ provisionOwnerWithHousehold: vi.fn() }));
vi.mock("@/lib/db/households", () => ({
  insertMembership: vi.fn(),
  updateMembershipRole: vi.fn(),
}));
vi.mock("@/lib/auth/session-owner", () => ({ resolveSessionOwnerFromCookie: vi.fn() }));
vi.mock("@/lib/queries/demo-conversion", () => ({ resolveDemoTrialStart: vi.fn() }));

const mockHeaders = headers as unknown as Mock;
const INVITE = { householdId: "hh-1", householdName: "Famille Dupont", role: "member" as const };

const owner = (overrides: Partial<OwnerContext> = {}): OwnerContext => ({
  ownerId: "owner-real",
  ownerName: null,
  ownerAlias: null,
  recoveryEmail: null,
  sessionId: "sid-real",
  memberships: [{ householdId: "hh-a", role: "member", isDemo: false }],
  ...overrides,
});

function request(body: unknown, raw = false): NextRequest {
  return new NextRequest("https://test.local/api/households/join", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHeaders.mockResolvedValue(
    new Headers({ "user-agent": "Mozilla/5.0", "x-forwarded-for": "1.2.3.4" }),
  );
  vi.mocked(joinRateLimit.limit).mockResolvedValue({ success: true } as never);
  vi.mocked(joinCodeRateLimit.limit).mockResolvedValue({ success: true } as never);
  vi.mocked(resolveInviteCode).mockResolvedValue(INVITE);
  vi.mocked(resolveSessionOwnerFromCookie).mockResolvedValue(null);
  vi.mocked(resolveDemoTrialStart).mockResolvedValue(null);
  vi.mocked(provisionOwnerWithHousehold).mockResolvedValue({
    ownerId: "owner-1",
    householdId: "hh-1",
    sessionId: "session-1",
  });
});

describe("POST /api/households/join", () => {
  it("413 avant toute lecture", async () => {
    const res = await POST(
      new NextRequest("https://test.local/api/households/join", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": String(2 * 1024 * 1024) },
      }),
    );
    expect(res.status).toBe(413);
    expect(resolveInviteCode).not.toHaveBeenCalled();
  });

  it("appareil neuf : saga owner neuf sur le foyer EXISTANT (jamais créé), cookie, /home", async () => {
    const res = await POST(request({ code: "OLIVE-4821" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirect: "/home" });
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get("atable_session")?.value).toBeTruthy();
    const [, input] = vi.mocked(provisionOwnerWithHousehold).mock.calls[0];
    expect(input.household).toEqual({ kind: "existing", householdId: "hh-1" });
    expect(input.role).toBe("member");
    expect(input.deviceName).toBeTruthy();
  });

  it("lien invité → membership 'guest'", async () => {
    vi.mocked(resolveInviteCode).mockResolvedValue({ ...INVITE, role: "guest" });
    await POST(request({ code: "THYME-0002" }));
    expect(vi.mocked(provisionOwnerWithHousehold).mock.calls[0][1].role).toBe("guest");
  });

  it("code hors format → 422, JSON illisible → 400, sans lookup", async () => {
    expect((await POST(request({ code: "nope" }))).status).toBe(422);
    expect((await POST(request("{oops", true))).status).toBe(400);
    expect(resolveInviteCode).not.toHaveBeenCalled();
  });

  it("429 par IP, puis 429 par code (brute-force distribué)", async () => {
    vi.mocked(joinRateLimit.limit).mockResolvedValueOnce({ success: false } as never);
    expect((await POST(request({ code: "OLIVE-4821" }))).status).toBe(429);
    vi.mocked(joinCodeRateLimit.limit).mockResolvedValueOnce({ success: false } as never);
    expect((await POST(request({ code: "OLIVE-4821" }))).status).toBe(429);
    expect(resolveInviteCode).not.toHaveBeenCalled();
  });

  it("404 quand le code ne correspond à aucun foyer", async () => {
    vi.mocked(resolveInviteCode).mockResolvedValue(null);
    expect((await POST(request({ code: "OLIVE-4821" }))).status).toBe(404);
    expect(provisionOwnerWithHousehold).not.toHaveBeenCalled();
  });

  it("session réelle, nouveau foyer → membership ajouté à l'owner existant (pas de cookie)", async () => {
    vi.mocked(resolveSessionOwnerFromCookie).mockResolvedValue(owner());
    const res = await POST(request({ code: "OLIVE-4821" }));
    expect(await res.json()).toEqual({ ok: true, redirect: "/household", added: true });
    expect(res.cookies.get("atable_session")).toBeUndefined();
    expect(insertMembership).toHaveBeenCalledWith(expect.anything(), {
      ownerId: "owner-real",
      householdId: "hh-1",
      role: "member",
    });
    expect(provisionOwnerWithHousehold).not.toHaveBeenCalled();
  });

  it("session réelle, déjà invité + code membre → upgrade ; déjà membre → noop", async () => {
    vi.mocked(resolveSessionOwnerFromCookie).mockResolvedValue(
      owner({ memberships: [{ householdId: "hh-1", role: "guest", isDemo: false }] }),
    );
    expect(await (await POST(request({ code: "OLIVE-4821" }))).json()).toEqual({
      ok: true,
      redirect: "/household",
      upgraded: true,
    });
    expect(updateMembershipRole).toHaveBeenCalledWith(expect.anything(), {
      ownerId: "owner-real",
      householdId: "hh-1",
      role: "member",
    });
    vi.mocked(resolveSessionOwnerFromCookie).mockResolvedValue(
      owner({ memberships: [{ householdId: "hh-1", role: "member", isDemo: false }] }),
    );
    expect(await (await POST(request({ code: "OLIVE-4821" }))).json()).toEqual({
      ok: true,
      redirect: "/household",
      alreadyMember: true,
    });
    expect(insertMembership).not.toHaveBeenCalled();
  });

  it("session DÉMO : sortie de démo = owner neuf avec marqueur de conversion", async () => {
    vi.mocked(resolveSessionOwnerFromCookie).mockResolvedValue(
      owner({
        ownerId: "owner-demo",
        memberships: [{ householdId: "demo", role: "member", isDemo: true }],
      }),
    );
    vi.mocked(resolveDemoTrialStart).mockResolvedValue("2026-09-01T10:00:00Z");
    const res = await POST(request({ code: "OLIVE-4821" }));
    expect(res.status).toBe(200);
    expect(vi.mocked(provisionOwnerWithHousehold).mock.calls[0][1].owner.demoTrialStartedAt).toBe(
      "2026-09-01T10:00:00Z",
    );
    expect(insertMembership).not.toHaveBeenCalled();
  });

  it("échec de la saga → 500 générique", async () => {
    vi.mocked(provisionOwnerWithHousehold).mockRejectedValue(new Error("secret db detail"));
    const res = await POST(request({ code: "OLIVE-4821" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur serveur" });
  });
});
