import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers, cookies } from "next/headers";
import { POST } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { getOwnerContext, type OwnerContext } from "@/lib/auth/owner-context";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn(), cookies: vi.fn() }));
vi.mock("@/lib/auth/owner-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/owner-context")>();
  return { ...actual, getOwnerContext: vi.fn() };
});
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn(async () => "fr") }));

const ANON = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";
const mockHeaders = headers as unknown as Mock;
const mockCookies = cookies as unknown as Mock;
const mockOwner = vi.mocked(getOwnerContext);

let supa: SupabaseMock;

function owner(overrides: Partial<OwnerContext> = {}): OwnerContext {
  return {
    ownerId: "owner-1",
    ownerName: null,
    ownerAlias: null,
    recoveryEmail: null,
    sessionId: "session-1",
    platform: "ios",
    memberships: [{ householdId: "hh-1", role: "member", isDemo: false }],
    ...overrides,
  };
}

function post(body: unknown, extraHeaders: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://test.local/api/events", {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
}

function insertedRows(): Record<string, unknown>[] {
  const call = supa.calls.find((c) => c.table === "events");
  const insert = call?.ops.find((o) => o.method === "insert");
  return (insert?.args[0] as Record<string, unknown>[]) ?? [];
}

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  mockHeaders.mockResolvedValue(new Headers({ "x-anon-id": ANON }));
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === "mijote_ab_onboarding" ? { value: "b" } : undefined),
  });
  mockOwner.mockResolvedValue(null);
});

describe("POST /api/events", () => {
  it("insère un lot valide, anonyme, avec le contexte photographié", async () => {
    const at = Date.now() - 1000;
    const res = await POST(
      post({
        platform: "ios",
        appVersion: "1.3.0",
        events: [
          { name: "screen.viewed", props: { route: "/", params: {} }, at },
          { name: "ui.clicked", props: { target: "landing.start", route: "/" }, at: at + 10 },
        ],
      }),
    );
    expect(res.status).toBe(204);
    const rows = insertedRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      anon_id: ANON,
      owner_id: null,
      platform: "ios",
      app_version: "1.3.0",
      locale: "fr",
      variant: "b",
      is_demo: false,
      source: "client",
      name: "screen.viewed",
      at: new Date(at).toISOString(),
    });
  });

  it("rattache l'owner, sa session et son foyer quand la session existe", async () => {
    mockOwner.mockResolvedValue(
      owner({ memberships: [{ householdId: "hh-demo", role: "member", isDemo: true }] }),
    );
    await POST(post({ events: [{ name: "app.opened", props: {}, at: Date.now() }] }));
    expect(insertedRows()[0]).toMatchObject({
      owner_id: "owner-1",
      device_id: "session-1",
      household_id: "hh-demo",
      is_demo: true,
      platform: "ios",
    });
  });

  it("sonde : 204 sans rien écrire", async () => {
    mockHeaders.mockResolvedValue(new Headers({ "x-anon-id": ANON, "x-probe": "1" }));
    const res = await POST(post({ events: [{ name: "app.opened", props: {}, at: Date.now() }] }));
    expect(res.status).toBe(204);
    expect(supa.calls).toHaveLength(0);
  });

  it("owner marqué sonde (is_probe, ex. le shell iOS d'Anthony sans cookie) : rien n'est écrit", async () => {
    mockOwner.mockResolvedValue(owner({ isProbe: true }));
    const res = await POST(post({ events: [{ name: "app.opened", props: {}, at: Date.now() }] }));
    expect(res.status).toBe(204);
    expect(supa.calls).toHaveLength(0);
  });

  it("sans x-anon-id (hors proxy) : rien n'est écrit", async () => {
    mockHeaders.mockResolvedValue(new Headers());
    await POST(post({ events: [{ name: "app.opened", props: {}, at: Date.now() }] }));
    expect(supa.calls).toHaveLength(0);
  });

  it("ignore ligne par ligne : nom hors catalogue, chaîne trop longue, prop imbriquée exotique", async () => {
    const at = Date.now();
    await POST(
      post({
        events: [
          { name: "recipe.viewed", props: {}, at }, // un moment, pas un fait
          { name: "ui.clicked", props: { target: "x".repeat(201), route: "/" }, at },
          { name: "ui.clicked", props: { target: "ok", route: "/", deep: { a: { b: 1 } } }, at },
          { name: "ui.clicked", props: { target: "ok", route: "/" }, at },
        ],
      }),
    );
    const rows = insertedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].props).toEqual({ target: "ok", route: "/" });
  });

  it("borne l'horloge client : ±10 min, sinon heure de réception ; plafonne le lot à 50", async () => {
    const now = Date.now();
    const events = Array.from({ length: 60 }, (_, i) => ({
      name: "app.resumed",
      props: {},
      at: i === 0 ? now - 3 * 3600_000 : now,
    }));
    await POST(post({ events }));
    const rows = insertedRows();
    expect(rows).toHaveLength(50);
    const first = new Date(rows[0].at as string).getTime();
    expect(Math.abs(first - now)).toBeLessThan(5_000);
  });

  it("corps invalide ou vide : 204, rien écrit", async () => {
    expect((await POST(post({ nope: true }))).status).toBe(204);
    expect((await POST(post("garbage"))).status).toBe(204);
    expect(supa.calls).toHaveLength(0);
  });
});
