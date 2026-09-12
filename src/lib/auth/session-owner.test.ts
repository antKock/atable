import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { redis } from "@/lib/redis";
import { signSession } from "@/lib/auth/session";
import { resolveOwnerContext } from "@/lib/auth/owner-context";
import { resolveSessionOwnerFromCookie } from "./session-owner";

vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn() } }));
vi.mock("@/lib/auth/owner-context", () => ({ resolveOwnerContext: vi.fn() }));

const OWNER = {
  ownerId: "owner-1",
  ownerName: null,
  ownerAlias: null,
  recoveryEmail: null,
  sessionId: "sid-1",
  memberships: [],
};

function requestWithCookie(value?: string): NextRequest {
  return new NextRequest("https://test.local/api/households", {
    method: "POST",
    headers: value ? { cookie: `atable_session=${value}` } : {},
  });
}

beforeEach(() => {
  vi.mocked(redis.get).mockReset().mockResolvedValue(null);
  vi.mocked(resolveOwnerContext).mockReset().mockResolvedValue(OWNER);
});

describe("resolveSessionOwnerFromCookie (revue 2026-09-12)", () => {
  it("renvoie null sans cookie, sans toucher Redis ni la base", async () => {
    expect(await resolveSessionOwnerFromCookie(requestWithCookie())).toBeNull();
    expect(redis.get).not.toHaveBeenCalled();
    expect(resolveOwnerContext).not.toHaveBeenCalled();
  });

  it("renvoie null pour un cookie invalide", async () => {
    expect(await resolveSessionOwnerFromCookie(requestWithCookie("not-a-jwt"))).toBeNull();
    expect(resolveOwnerContext).not.toHaveBeenCalled();
  });

  it("résout l'owner d'une session valide et non révoquée", async () => {
    const jwt = await signSession({ sid: "sid-1" });
    expect(await resolveSessionOwnerFromCookie(requestWithCookie(jwt))).toEqual(OWNER);
    expect(redis.get).toHaveBeenCalledWith("revoked:sid-1");
    expect(resolveOwnerContext).toHaveBeenCalledWith("sid-1");
  });

  it("ignore une session RÉVOQUÉE (« Se déconnecter » ailleurs) : null, base non consultée", async () => {
    vi.mocked(redis.get).mockResolvedValue("1");
    const jwt = await signSession({ sid: "sid-1" });
    expect(await resolveSessionOwnerFromCookie(requestWithCookie(jwt))).toBeNull();
    expect(resolveOwnerContext).not.toHaveBeenCalled();
  });

  it("laisse passer (fail-open) quand Redis est indisponible, comme le proxy", async () => {
    vi.mocked(redis.get).mockRejectedValue(new Error("redis down"));
    const jwt = await signSession({ sid: "sid-1" });
    expect(await resolveSessionOwnerFromCookie(requestWithCookie(jwt))).toEqual(OWNER);
  });
});
