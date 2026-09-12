import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { syncAppStore } from "@/lib/apple-connect/sync";
import * as Sentry from "@sentry/nextjs";

vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => ({}) }));
vi.mock("@/lib/apple-connect/sync", () => ({ syncAppStore: vi.fn() }));

const monitor = vi.hoisted(() => ({ status: null as null | "ok" | "error", name: "" }));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withMonitor: async (name: string, fn: () => unknown) => {
    monitor.name = name;
    try {
      const out = await fn();
      monitor.status = "ok";
      return out;
    } catch (err) {
      monitor.status = "error";
      throw err;
    }
  },
}));

const ENV_KEYS = ["CRON_SECRET", "APPLE_CONNECT_KEY", "APPLE_CONNECT_KEY_ID", "APPLE_CONNECT_ISSUER_ID", "APPLE_CONNECT_APP_ID"] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.APPLE_CONNECT_KEY = "MIGH";
  process.env.APPLE_CONNECT_KEY_ID = "K";
  process.env.APPLE_CONNECT_ISSUER_ID = "I";
  process.env.APPLE_CONNECT_APP_ID = "6772487648";
  monitor.status = null;
  monitor.name = "";
  vi.mocked(syncAppStore).mockReset();
  vi.mocked(Sentry.captureException).mockClear();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

function request(auth?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = auth;
  return new NextRequest("https://test.local/api/cron/app-store-sync", { headers });
}

describe("GET /api/cron/app-store-sync — authentification", () => {
  it("401 sans en-tête", async () => {
    expect((await GET(request())).status).toBe(401);
    expect(syncAppStore).not.toHaveBeenCalled();
  });

  it("401 avec un mauvais jeton", async () => {
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
  });

  it("401 si CRON_SECRET n'est pas posé, même avec « Bearer undefined »", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(request("Bearer undefined"))).status).toBe(401);
  });
});

describe("GET /api/cron/app-store-sync — exécution", () => {
  it("503 sans configuration App Store Connect (staging sans clé), sans alerte Sentry", async () => {
    delete process.env.APPLE_CONNECT_APP_ID;
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(503);
    expect(syncAppStore).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("lance la synchro sous le moniteur « app-store-sync » et renvoie le résumé", async () => {
    const summary = { requestId: "req", reports: {} };
    vi.mocked(syncAppStore).mockResolvedValue(summary as never);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(summary);
    expect(monitor.name).toBe("app-store-sync");
    expect(monitor.status).toBe("ok");
    expect(vi.mocked(syncAppStore).mock.calls[0][0]).toMatchObject({ appId: "6772487648" });
  });

  it("500 + moniteur en erreur + Sentry quand la synchro échoue", async () => {
    vi.mocked(syncAppStore).mockRejectedValue(new Error("apple down"));
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(500);
    expect(monitor.status).toBe("error");
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
