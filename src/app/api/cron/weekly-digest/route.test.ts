import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getDashboardV3 } from "@/lib/admin/v3/data";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import { createServerClient } from "@/lib/supabase/server";
import * as Sentry from "@sentry/nextjs";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/admin/v3/data", () => ({ getDashboardV3: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const overview = {
  dataDate: "2026-09-14",
  weekLabel: "semaine du 7 sept.",
  northStar: { value: 41, engaged: 28, total: 81, delta: 18, fourWeeksAgo: 23, series: [], seriesLabels: [] },
  tiles: [{ id: "new", label: "Nouvelles personnes · 4 sem.", value: "25", compare: "vs 15" }],
  health: { ok: true, pipeline: { ok: true, detail: "" }, crons: { ok: true, detail: "" }, demo: { ok: true, detail: "" } },
  moved: ["11 nouvelles personnes la semaine dernière."],
};

const ENV = ["CRON_SECRET", "DIGEST_TO", "RESEND_API_KEY", "EMAIL_FROM", "APP_ORIGIN"] as const;
const saved: Partial<Record<(typeof ENV)[number], string | undefined>> = {};
let supa: SupabaseMock;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const k of ENV) saved[k] = process.env[k];
  process.env.DIGEST_TO = "anthony@example.com";
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "Mijote <no-reply@mijote.test>";
  process.env.APP_ORIGIN = "https://mijote.test";
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  vi.mocked(getDashboardV3).mockResolvedValue({ data: { overview } } as never);
  fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(Sentry.captureException).mockClear();
});

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

const req = (auth?: string) => new NextRequest("https://test.local/api/cron/weekly-digest", { headers: auth ? { authorization: auth } : {} });

describe("GET /api/cron/weekly-digest", () => {
  it("401 sans secret", async () => {
    expect((await GET(req())).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("503 sans DIGEST_TO (staging), sans alerte", async () => {
    delete process.env.DIGEST_TO;
    expect((await GET(req("Bearer test-cron-secret"))).status).toBe(503);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("envoie le digest de la dernière semaine close via Resend et le journalise", async () => {
    supa.queueResults([{ data: null, error: null }, { error: null }]); // digests_sent lookup → absent ; insert
    const res = await GET(req("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ sent: true, to: "anthony@example.com" });
    expect(body.week).toMatch(/^\d{4}-W\d{2}$/);
    expect(body.subject).toContain("41 cuisiniers actifs (+18)");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({ from: "Mijote <no-reply@mijote.test>", to: "anthony@example.com" });
    expect(payload.text).toContain("https://mijote.test/admin/stats");
    expect(payload.html).toContain("11 nouvelles personnes");

    const insert = supa.calls.find((c) => c.table === "digests_sent" && c.ops.some((o) => o.method === "insert"));
    expect(insert?.ops.find((o) => o.method === "insert")?.args[0]).toMatchObject({ week: body.week, sent_to: "anthony@example.com" });
  });

  it("ne renvoie pas deux fois la même semaine (idempotent)", async () => {
    supa.queueResults([{ data: { week: "2026-W37" }, error: null }]);
    const res = await GET(req("Bearer test-cron-secret"));
    expect(await res.json()).toMatchObject({ sent: false, reason: "already sent" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("500 + Sentry si Resend refuse, sans journaliser", async () => {
    supa.queueResults([{ data: null, error: null }]);
    fetchMock.mockResolvedValueOnce(new Response("domain not verified", { status: 403 }));
    const res = await GET(req("Bearer test-cron-secret"));
    expect(res.status).toBe(500);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(supa.calls.some((c) => c.table === "digests_sent" && c.ops.some((o) => o.method === "insert"))).toBe(false);
  });
});
