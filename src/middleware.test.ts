import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { verifySession, signSession } from "@/lib/auth/session";
import { redis } from "@/lib/redis";

vi.mock("@/lib/auth/session", () => ({
  verifySession: vi.fn(),
  signSession: vi.fn(),
  setSessionCookie: (
    response: { cookies: { set: (opts: object) => void } },
    token: string,
  ) => {
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
  opts: { cookie?: string; ua?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.ua) headers["user-agent"] = opts.ua;
  const req = new NextRequest(`https://atable.test${path}`, { headers });
  if (opts.cookie) req.cookies.set("atable_session", opts.cookie);
  return req;
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

describe("middleware — bots", () => {
  it("lets social-media crawlers through untouched", async () => {
    const res = await middleware(makeRequest("/home", { ua: "WhatsApp/2.23" }));
    expect(res.headers.get("location")).toBeNull();
    expect(verifySession).not.toHaveBeenCalled();
  });
});

describe("middleware — public routes", () => {
  it("allows the landing page with no session", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await middleware(makeRequest("/"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows a /join/ link with no session", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await middleware(makeRequest("/join/OLIVE-4821"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows /legal/* pages with no session (privacy policy must be public)", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await middleware(makeRequest("/legal/confidentialite"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows /support with no session (App Store Connect support URL)", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await middleware(makeRequest("/support"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects an authenticated user away from the landing page", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    const res = await middleware(makeRequest("/", { cookie: "valid-token" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/home");
  });
});

describe("middleware — protected routes", () => {
  it("redirects to the landing page when there is no session", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await middleware(makeRequest("/home"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://atable.test/");
  });

  it("allows a valid, non-revoked session through", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    vi.mocked(redis.get).mockResolvedValue(null);
    const res = await middleware(makeRequest("/home", { cookie: "valid-token" }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects and clears the cookie for a revoked session", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    vi.mocked(redis.get).mockResolvedValue("1"); // revoked marker present
    const res = await middleware(makeRequest("/home", { cookie: "valid-token" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://atable.test/");
    expect(res.cookies.get("atable_session")?.value).toBe("");
  });

  it("fails open (allows through) when Redis errors", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    vi.mocked(redis.get).mockRejectedValue(new Error("redis down"));
    const res = await middleware(makeRequest("/home", { cookie: "valid-token" }));
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("middleware — sliding session renewal", () => {
  it("re-signs and sets a fresh cookie when the token is older than the renewal window", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    vi.mocked(redis.get).mockResolvedValue(null);
    const res = await middleware(makeRequest("/home", { cookie: "old-token" }));
    expect(signSession).toHaveBeenCalledWith({ sid: "session-1" });
    expect(res.cookies.get("atable_session")?.value).toBe("renewed-token");
  });

  it("does not renew a token younger than the renewal window", async () => {
    vi.mocked(verifySession).mockResolvedValue(FRESH_PAYLOAD);
    vi.mocked(redis.get).mockResolvedValue(null);
    const res = await middleware(makeRequest("/home", { cookie: "fresh-token" }));
    expect(signSession).not.toHaveBeenCalled();
    expect(res.cookies.get("atable_session")).toBeUndefined();
  });

  it("still serves the request when renewal signing fails", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    vi.mocked(signSession).mockRejectedValue(new Error("no secret"));
    vi.mocked(redis.get).mockResolvedValue(null);
    const res = await middleware(makeRequest("/home", { cookie: "old-token" }));
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("middleware — regression guards", () => {
  it("never emits x-dbg-* debug headers (Fix 1.3)", async () => {
    vi.mocked(verifySession).mockResolvedValue(PAYLOAD);
    vi.mocked(redis.get).mockResolvedValue(null);

    const authed = await middleware(
      makeRequest("/home", { cookie: "valid-token" }),
    );
    expect(hasDebugHeaders(authed)).toBe(false);

    vi.mocked(verifySession).mockResolvedValue(null);
    const anon = await middleware(makeRequest("/home"));
    expect(hasDebugHeaders(anon)).toBe(false);
  });
});
