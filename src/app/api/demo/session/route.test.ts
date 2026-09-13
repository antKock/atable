import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { headers } from "next/headers";
import { provisionOwnerWithHousehold } from "@/lib/db/onboarding";
import { demoSessionRateLimit } from "@/lib/redis";

// Route « essayer la démo » sur des mocks de fonctions db/* (lot 5).
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn(() => ({})) }));
vi.mock("@/lib/db/onboarding", () => ({ provisionOwnerWithHousehold: vi.fn() }));
// Limiteur par IP (5/h) : compteur en mémoire par clé, comme le ferait Redis.
vi.mock("@/lib/redis", () => ({ demoSessionRateLimit: { limit: vi.fn() } }));
// getLocale() lit headers()/cookies() de la requête : pilotés ici.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://test.local/api/demo/session", {
    method: "POST",
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      "x-forwarded-for": "203.0.113.7",
      ...headers,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(provisionOwnerWithHousehold).mockResolvedValue({
    ownerId: "owner-1",
    householdId: process.env.DEMO_HOUSEHOLD_ID!,
    sessionId: "session-1",
  });
  const hits = new Map<string, number>();
  vi.mocked(demoSessionRateLimit.limit).mockImplementation(async (key: string) => {
    const n = (hits.get(key) ?? 0) + 1;
    hits.set(key, n);
    return { success: n <= 5 } as never;
  });
});

describe("POST /api/demo/session", () => {
  it("owner neuf membre du foyer DÉMO (existant, jamais créé), cookie, redirect /home (200, pas 303)", async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirect: "/home" });
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get("atable_session")?.value.length).toBeGreaterThan(10);
    const [, input] = vi.mocked(provisionOwnerWithHousehold).mock.calls[0];
    expect(input.household).toEqual({
      kind: "existing",
      householdId: process.env.DEMO_HOUSEHOLD_ID,
    });
    expect(input.role).toBe("member");
    expect(input.owner.id).toBeTruthy();
    expect(input.owner.alias).toBeTruthy();
    expect(input.owner.demoTrialStartedAt).toBeUndefined();
  });

  it("appareil anglais → foyer démo EN s'il est configuré", async () => {
    vi.stubEnv("DEMO_HOUSEHOLD_ID_EN", "00000000-0000-0000-0000-00000000e000");
    vi.stubEnv("I18N_EN_ENABLED", "1");
    vi.mocked(headers).mockResolvedValue(
      new Headers({ "accept-language": "en-US,en;q=0.9" }) as never,
    );
    try {
      await POST(request({ "accept-language": "en-US,en;q=0.9" }));
      const [, input] = vi.mocked(provisionOwnerWithHousehold).mock.calls[0];
      expect(input.household).toEqual({
        kind: "existing",
        householdId: "00000000-0000-0000-0000-00000000e000",
      });
    } finally {
      vi.unstubAllEnvs();
      vi.mocked(headers).mockResolvedValue(new Headers() as never);
    }
  });

  it("503 si la démo n'est pas configurée", async () => {
    vi.stubEnv("DEMO_HOUSEHOLD_ID", "");
    try {
      expect((await POST(request())).status).toBe(503);
      expect(provisionOwnerWithHousehold).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("échec de la saga → 500 générique", async () => {
    vi.mocked(provisionOwnerWithHousehold).mockRejectedValue(new Error("insert failed"));
    const res = await POST(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur serveur" });
  });

  it("limite à 5 sessions démo par IP et par heure : le 6e appel répond 429", async () => {
    for (let i = 0; i < 5; i++) expect((await POST(request())).status).toBe(200);
    const res = await POST(request());
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("DEMO_QUOTA");
    expect(provisionOwnerWithHousehold).toHaveBeenCalledTimes(5);
    expect((await POST(request({ "x-forwarded-for": "198.51.100.9" }))).status).toBe(200);
  });

  it("413 avant toute écriture", async () => {
    const res = await POST(request({ "content-length": String(2 * 1024 * 1024) }));
    expect(res.status).toBe(413);
    expect(provisionOwnerWithHousehold).not.toHaveBeenCalled();
  });
});
