import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { verifySession, signSession } from "@/lib/auth/session";
import { redis } from "@/lib/redis";

vi.mock("@/lib/auth/session", () => ({
  verifySession: vi.fn(),
  signSession: vi.fn(),
  setSessionCookie: (response: { cookies: { set: (opts: object) => void } }, token: string) => {
    response.cookies.set({ name: "atable_session", value: token });
  },
  SESSION_RENEW_AFTER_S: 60 * 60 * 24 * 30,
}));
vi.mock("@/lib/redis", () => ({
  redis: { get: vi.fn() },
  joinRateLimit: { limit: vi.fn() },
}));

function nowS(): number {
  return Math.floor(Date.now() / 1000);
}

// iat older than the 30-day renewal window → triggers sliding renewal
const PAYLOAD = { hid: "household-1", sid: "session-1", iat: 1_700_000_000 };
// iat fresh → no renewal
const FRESH_PAYLOAD = { hid: "household-1", sid: "session-1", iat: nowS() };

function makeRequest(
  path: string,
  opts: {
    cookie?: string;
    ua?: string;
    headers?: Record<string, string>;
    probeCookie?: boolean;
    method?: string;
  } = {},
): NextRequest {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.ua) headers["user-agent"] = opts.ua;
  const req = new NextRequest(`https://atable.test${path}`, {
    headers,
    method: opts.method ?? "GET",
  });
  if (opts.cookie) req.cookies.set("atable_session", opts.cookie);
  if (opts.probeCookie) req.cookies.set("mijote_probe", "1");
  return req;
}

/** En-tête injecté sur la requête interne (NextResponse.next({ request })). */
function forwardedHeader(res: { headers: Headers }, name: string): string | null {
  const names = res.headers.get("x-middleware-request-" + name);
  return names;
}

/** True if any response header name starts with `x-dbg`. */
function hasDebugHeaders(res: { headers: Headers }): boolean {
  let found = false;
  res.headers.forEach((_value, key) => {
    if (key.toLowerCase().startsWith("x-dbg")) found = true;
  });
  return found;
}

beforeEach(() => {
  vi.mocked(verifySession).mockReset();
  vi.mocked(signSession).mockReset();
  vi.mocked(signSession).mockResolvedValue("renewed-token");
  vi.mocked(redis.get).mockReset();
});

describe("proxy — bots", () => {
  it("lets social-media crawlers through untouched", async () => {
    const res = await proxy(makeRequest("/home", { ua: "WhatsApp/2.23" }));
    expect(res.headers.get("location")).toBeNull();
    expect(verifySession).not.toHaveBeenCalled();
  });
});

// Scanners de la faille « server actions » de Next, vus en prod le 2026-09-14 :
// POST multipart sur `/` sans cookie ni `Next-Action`, UA Chrome falsifié → 500
// « Failed to find Server Action ». Aucune server action n'est postée sur la
// landing (la seule du repo vit sur /admin/sante), donc tout POST y est illégitime.
describe("proxy — landing en lecture seule", () => {
  it("rejects a POST on the landing with 405 instead of letting Next 500", async () => {
    const res = await proxy(makeRequest("/", { method: "POST" }));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD");
  });

  it("rejects the scanner shape even behind a social-crawler user-agent", async () => {
    const res = await proxy(makeRequest("/", { method: "POST", ua: "WhatsApp/2.23" }));
    expect(res.status).toBe(405);
  });

  it("poses no A/B cookie on a rejected POST (le test #25 ne doit pas le compter)", async () => {
    const res = await proxy(makeRequest("/", { method: "POST" }));
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("still serves HEAD on the landing (health checks)", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await proxy(makeRequest("/", { method: "HEAD" }));
    expect(res.status).not.toBe(405);
  });

  it("leaves POSTs on other routes alone", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await proxy(makeRequest("/api/households", { method: "POST" }));
    expect(res.status).not.toBe(405);
  });
});

describe("proxy — public routes", () => {
  it("allows the landing page with no session", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await proxy(makeRequest("/"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows a /join/ link with no session", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await proxy(makeRequest("/join/OLIVE-4821"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows /legal/* pages with no session (privacy policy must be public)", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await proxy(makeRequest("/legal/confidentialite"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows /support with no session (App Store Connect support URL)", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await proxy(makeRequest("/support"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects an authenticated user away from the landing page", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    const res = await proxy(makeRequest("/", { cookie: "valid-token" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/home");
  });
});

describe("proxy — protected routes", () => {
  it("redirects to the landing page when there is no session", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await proxy(makeRequest("/home"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://atable.test/");
  });

  it("allows a valid, non-revoked session through", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    vi.mocked(redis.get).mockResolvedValue(null);
    const res = await proxy(makeRequest("/home", { cookie: "valid-token" }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects and clears the cookie for a revoked session", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    vi.mocked(redis.get).mockResolvedValue("1"); // revoked marker present
    const res = await proxy(makeRequest("/home", { cookie: "valid-token" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://atable.test/");
    expect(res.cookies.get("atable_session")?.value).toBe("");
  });

  it("fails open (allows through) when Redis errors", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    vi.mocked(redis.get).mockRejectedValue(new Error("redis down"));
    const res = await proxy(makeRequest("/home", { cookie: "valid-token" }));
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("proxy — sliding session renewal", () => {
  it("re-signs and sets a fresh cookie when the token is older than the renewal window", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    vi.mocked(redis.get).mockResolvedValue(null);
    const res = await proxy(makeRequest("/home", { cookie: "old-token" }));
    expect(signSession).toHaveBeenCalledWith({ sid: "session-1" });
    expect(res.cookies.get("atable_session")?.value).toBe("renewed-token");
  });

  it("does not renew a token younger than the renewal window", async () => {
    vi.mocked(verifySession).mockResolvedValue(FRESH_PAYLOAD);
    vi.mocked(redis.get).mockResolvedValue(null);
    const res = await proxy(makeRequest("/home", { cookie: "fresh-token" }));
    expect(signSession).not.toHaveBeenCalled();
    expect(res.cookies.get("atable_session")).toBeUndefined();
  });

  it("still serves the request when renewal signing fails", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    vi.mocked(signSession).mockRejectedValue(new Error("no secret"));
    vi.mocked(redis.get).mockResolvedValue(null);
    const res = await proxy(makeRequest("/home", { cookie: "old-token" }));
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("proxy — regression guards", () => {
  it("never emits x-dbg-* debug headers (Fix 1.3)", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    vi.mocked(redis.get).mockResolvedValue(null);

    const authed = await proxy(makeRequest("/home", { cookie: "valid-token" }));
    expect(hasDebugHeaders(authed)).toBe(false);

    vi.mocked(verifySession).mockResolvedValue(null);
    const anon = await proxy(makeRequest("/home"));
    expect(hasDebugHeaders(anon)).toBe(false);
  });
});

describe("/api/admin/* — garde par défaut (revue 2026-09-12)", () => {
  const withAuth = (path: string, auth?: string) => {
    const req = makeRequest(path);
    if (auth) req.headers.set("authorization", auth);
    return req;
  };

  it("refuse (401) sans en-tête, même sans session requise", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "admin-secret");
    const res = await proxy(withAuth("/api/admin/whatever"));
    expect(res.status).toBe(401);
  });

  it("laisse passer avec le bon secret", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "admin-secret");
    const res = await proxy(withAuth("/api/admin/whatever", "Bearer admin-secret"));
    expect(res.status).toBe(200);
  });

  it("repli sur BATCH_ENRICH_SECRET quand ADMIN_API_SECRET est absent", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "");
    vi.stubEnv("BATCH_ENRICH_SECRET", "batch-secret");
    expect((await proxy(withAuth("/api/admin/batch-enrich", "Bearer batch-secret"))).status).toBe(
      200,
    );
    expect((await proxy(withAuth("/api/admin/batch-enrich", "Bearer nope"))).status).toBe(401);
  });

  it("aucun secret configuré → tout refusé (jamais `Bearer undefined`)", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "");
    vi.stubEnv("BATCH_ENRICH_SECRET", "");
    expect((await proxy(withAuth("/api/admin/x", "Bearer undefined"))).status).toBe(401);
  });
});

describe("proxy — sondes (#26)", () => {
  beforeEach(() => vi.mocked(verifySession).mockResolvedValue(null));

  it("?probe=1 sur la landing → cookie mijote_probe (1 an) et x-probe injecté", async () => {
    const res = await proxy(makeRequest("/?probe=1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/mijote_probe=1;.*Max-Age=31536000.*HttpOnly/);
    expect(forwardedHeader(res, "x-probe")).toBe("1");
  });

  it("cookie ou en-tête x-mijote-probe → x-probe injecté, pas de nouveau cookie", async () => {
    const byCookie = await proxy(makeRequest("/api/version", { probeCookie: true }));
    expect(forwardedHeader(byCookie, "x-probe")).toBe("1");
    expect(byCookie.headers.get("set-cookie") ?? "").not.toContain("mijote_probe");
    const byHeader = await proxy(
      makeRequest("/api/version", { headers: { "x-mijote-probe": "1" } }),
    );
    expect(forwardedHeader(byHeader, "x-probe")).toBe("1");
  });

  it("un x-probe forgé par le client est retiré ; sans marqueur, rien n'est injecté", async () => {
    const forged = await proxy(makeRequest("/api/version", { headers: { "x-probe": "1" } }));
    expect(forwardedHeader(forged, "x-probe")).toBeNull();
    const plain = await proxy(makeRequest("/api/version"));
    expect(forwardedHeader(plain, "x-probe")).toBeNull();
  });

  it("A/B : une sonde reçoit un bras mais n'est pas comptée (pas de x-ab-onboarding-fresh)", async () => {
    process.env.AB_ONBOARDING_ENABLED = "1";
    try {
      const res = await proxy(makeRequest("/", { probeCookie: true }));
      expect(res.headers.get("set-cookie")).toContain("mijote_ab_onboarding=");
      expect(forwardedHeader(res, "x-ab-onboarding")).toMatch(/^[ab]$/);
      expect(forwardedHeader(res, "x-ab-onboarding-fresh")).toBeNull();
    } finally {
      delete process.env.AB_ONBOARDING_ENABLED;
    }
  });
});

describe("proxy — identité anonyme des événements (#28)", () => {
  const ANON = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";

  it("pose le cookie mijote_aid à la première requête et l'injecte en x-anon-id", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await proxy(makeRequest("/join/ABCD"));
    const cookie = res.cookies.get("mijote_aid")?.value;
    expect(cookie).toMatch(/^[0-9a-f-]{36}$/);
    expect(forwardedHeader(res, "x-anon-id")).toBe(cookie);
  });

  it("réutilise le cookie existant sans le reposer ; un x-anon-id client est écrasé", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const req = makeRequest("/support", { headers: { "x-anon-id": "spoof" } });
    req.cookies.set("mijote_aid", ANON);
    const res = await proxy(req);
    expect(res.cookies.get("mijote_aid")).toBeUndefined();
    expect(forwardedHeader(res, "x-anon-id")).toBe(ANON);
  });

  it("remplace un cookie mal formé", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const req = makeRequest("/support");
    req.cookies.set("mijote_aid", "garbage");
    const res = await proxy(req);
    expect(res.cookies.get("mijote_aid")?.value).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("/api/events est public, et reçoit x-session-id quand un jeton est valide", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const anon = await proxy(makeRequest("/api/events", { method: "POST" }));
    expect(anon.status).toBe(200);
    expect(forwardedHeader(anon, "x-session-id")).toBeNull();

    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    const withSession = await proxy(makeRequest("/api/events", { method: "POST", cookie: "tok" }));
    expect(withSession.status).toBe(200);
    expect(forwardedHeader(withSession, "x-session-id")).toBe(PAYLOAD.sid);
    // Pas de contrôle de révocation Redis sur cette route.
    expect(redis.get).not.toHaveBeenCalled();
  });
});

describe("proxy — ?probe=1 sur toute page (shell iOS via lien universel)", () => {
  it("pose le cookie sonde depuis /join/… et /r/…, jamais depuis une route API", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const join = await proxy(makeRequest("/join/ABCD-1234?probe=1"));
    expect(join.cookies.get("mijote_probe")?.value).toBe("1");
    expect(forwardedHeader(join, "x-probe")).toBe("1");
    const api = await proxy(
      makeRequest("/api/households/lookup?code=X&probe=1", { method: "GET" }),
    );
    expect(api.cookies.get("mijote_probe")).toBeUndefined();
    expect(forwardedHeader(api, "x-probe")).toBeNull();
  });
});
