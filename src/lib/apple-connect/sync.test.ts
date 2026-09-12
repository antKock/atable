import { describe, it, expect, vi, beforeEach } from "vitest";
import { gzipSync } from "node:zlib";
import { generateKeyPairSync } from "node:crypto";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import { createAppleConnectClient, type FetchLike } from "./client";
import { syncAppStore } from "./sync";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const CREDS = {
  key: (privateKey.export({ format: "der", type: "pkcs8" }) as Buffer).toString("base64"),
  keyId: "K",
  issuerId: "I",
};

const DL_HEADER =
  "Date\tApp Name\tApp Apple Identifier\tDownload Type\tApp Version\tDevice\tPlatform Version\tSource Type\tPage Type\tPre-Order\tTerritory\tCounts";
const ENG_HEADER =
  "Date\tApp Name\tApp Apple Identifier\tEvent\tPage Type\tPage Title\tSource Type\tSource Info\tCampaign\tEngagement Type\tDevice\tPlatform Version\tTerritory\tCounts\tUnique Counts";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const gz = (text: string) => new Response(gzipSync(Buffer.from(text)));

/** API Apple simulée : 1 requête ONGOING, 2 rapports, instances et contenus paramétrables. */
function fakeApple(opts: {
  downloads: { id: string; processingDate: string; tsv: string }[];
  engagement: { id: string; processingDate: string; tsv: string }[];
}) {
  const bodies = new Map<string, string>();
  for (const i of [...opts.downloads, ...opts.engagement]) bodies.set(i.id, i.tsv);
  const fetchImpl = vi.fn<FetchLike>(async (url) => {
    if (url.endsWith("/analyticsReportRequests")) {
      return json({ data: [{ id: "req", attributes: { accessType: "ONGOING", stoppedDueToInactivity: false } }] });
    }
    if (url.includes("/reports?filter[name]=")) {
      const name = decodeURIComponent(url.split("filter[name]=")[1]);
      const id = name.startsWith("App Downloads") ? "r3" : "r15";
      return json({ data: [{ id, attributes: { name, category: "x" } }] });
    }
    if (url.includes("/analyticsReports/r3/instances")) {
      return json({ data: opts.downloads.map((i) => ({ id: i.id, attributes: { granularity: "DAILY", processingDate: i.processingDate } })) });
    }
    if (url.includes("/analyticsReports/r15/instances")) {
      return json({ data: opts.engagement.map((i) => ({ id: i.id, attributes: { granularity: "DAILY", processingDate: i.processingDate } })) });
    }
    const seg = url.match(/analyticsReportInstances\/([^/]+)\/segments/);
    if (seg) return json({ data: [{ attributes: { url: `https://s3.example/${seg[1]}.gz` } }] });
    const file = url.match(/s3\.example\/(.+)\.gz$/);
    if (file) return gz(bodies.get(file[1]) ?? "");
    return new Response("not found", { status: 404 });
  });
  return fetchImpl;
}

let supa: SupabaseMock;
beforeEach(() => {
  supa = createSupabaseMock();
});

const rpcCalls = () => supa.calls.filter((c) => c.table === "rpc:app_store_daily_replace").map((c) => c.ops[0].args[0]);
const marks = () =>
  supa.calls
    .filter((c) => c.table === "app_store_sync_instances" && c.ops.some((o) => o.method === "insert"))
    .map((c) => c.ops.find((o) => o.method === "insert")!.args[0]);

describe("syncAppStore", () => {
  it("intègre chaque instance inconnue : remplacement par jour × rapport, puis journalisation", async () => {
    const fetchImpl = fakeApple({
      downloads: [
        {
          id: "d1",
          processingDate: "2026-09-10",
          tsv: `${DL_HEADER}\n2026-09-09\tMijote\t1\tFirst-time download\t1.3\tiPhone\tiOS\tApp Store search\tNo page\t\tFR\t14\n`,
        },
      ],
      engagement: [
        {
          id: "e1",
          processingDate: "2026-09-10",
          tsv: `${ENG_HEADER}\n2026-09-09\tMijote\t1\tImpression\tNo page\tNo page\tApp Store search\t\t\t\tiPhone\tiOS\tFR\t36\t16\n`,
        },
      ],
    });
    // 1) select des instances vues (aucune) ; puis par instance : rpc + insert.
    supa.queueResults([{ data: [] }, { error: null }, { error: null }, { error: null }, { error: null }]);

    const summary = await syncAppStore({
      client: createAppleConnectClient(CREDS, fetchImpl),
      supabase: supa.client,
      appId: "123",
    });

    expect(summary.requestId).toBe("req");
    expect(summary.reports.downloads).toMatchObject({ reportId: "r3", instances: 1, processed: 1, skipped: 0, days: ["2026-09-09"] });
    expect(summary.reports.engagement).toMatchObject({ reportId: "r15", instances: 1, processed: 1, skipped: 0, days: ["2026-09-09"] });

    expect(rpcCalls()).toEqual([
      {
        p_day: "2026-09-09",
        p_report: "downloads",
        p_rows: [{ source_type: "App Store search", source_info: "", dl_first_time: 14, dl_redownload: 0, dl_update: 0 }],
      },
      {
        p_day: "2026-09-09",
        p_report: "engagement",
        p_rows: [
          {
            source_type: "App Store search",
            source_info: "",
            eng_impressions: 36,
            eng_impressions_uniq: 16,
            eng_page_views: 0,
            eng_page_views_uniq: 0,
            eng_taps: 0,
          },
        ],
      },
    ]);
    expect(marks()).toEqual([
      { instance_id: "d1", report: "downloads", processing_date: "2026-09-10", data_days: ["2026-09-09"], row_count: 1 },
      { instance_id: "e1", report: "engagement", processing_date: "2026-09-10", data_days: ["2026-09-09"], row_count: 1 },
    ]);
  });

  it("saute les instances déjà journalisées (idempotence) sans rien télécharger", async () => {
    const fetchImpl = fakeApple({
      downloads: [{ id: "d1", processingDate: "2026-09-10", tsv: DL_HEADER }],
      engagement: [{ id: "e1", processingDate: "2026-09-10", tsv: ENG_HEADER }],
    });
    supa.queueResults([{ data: [{ instance_id: "d1" }, { instance_id: "e1" }] }]);

    const summary = await syncAppStore({ client: createAppleConnectClient(CREDS, fetchImpl), supabase: supa.client, appId: "123" });

    expect(summary.reports.downloads).toMatchObject({ processed: 0, skipped: 1 });
    expect(summary.reports.engagement).toMatchObject({ processed: 0, skipped: 1 });
    expect(rpcCalls()).toEqual([]);
    expect(fetchImpl.mock.calls.some(([url]) => url.includes("/segments"))).toBe(false);
  });

  it("une instance vide remet à zéro le jour attendu (J-1) pour ce rapport", async () => {
    const fetchImpl = fakeApple({
      downloads: [{ id: "d-empty", processingDate: "2026-09-06", tsv: `${DL_HEADER}\n` }],
      engagement: [],
    });
    supa.queueResults([{ data: [] }, { error: null }, { error: null }]);

    const summary = await syncAppStore({ client: createAppleConnectClient(CREDS, fetchImpl), supabase: supa.client, appId: "123" });

    expect(rpcCalls()).toEqual([{ p_day: "2026-09-05", p_report: "downloads", p_rows: [] }]);
    expect(marks()[0]).toMatchObject({ instance_id: "d-empty", data_days: ["2026-09-05"], row_count: 0 });
    expect(summary.reports.downloads.days).toEqual(["2026-09-05"]);
  });

  it("propage l'échec du remplacement SQL sans journaliser l'instance", async () => {
    const fetchImpl = fakeApple({
      downloads: [{ id: "d1", processingDate: "2026-09-10", tsv: `${DL_HEADER}\n` }],
      engagement: [],
    });
    supa.queueResults([{ data: [] }, { error: { message: "boom" } }]);

    await expect(
      syncAppStore({ client: createAppleConnectClient(CREDS, fetchImpl), supabase: supa.client, appId: "123" }),
    ).rejects.toThrow(/app_store_daily_replace\(2026-09-09, downloads\): boom/);
    expect(marks()).toEqual([]);
  });

  it("borne le rattrapage à maxPerRun instances par rapport", async () => {
    const fetchImpl = fakeApple({
      downloads: [
        { id: "d1", processingDate: "2026-09-08", tsv: `${DL_HEADER}\n` },
        { id: "d2", processingDate: "2026-09-09", tsv: `${DL_HEADER}\n` },
        { id: "d3", processingDate: "2026-09-10", tsv: `${DL_HEADER}\n` },
      ],
      engagement: [],
    });
    supa.queueResults([{ data: [] }, { error: null }, { error: null }, { error: null }, { error: null }]);

    const summary = await syncAppStore({
      client: createAppleConnectClient(CREDS, fetchImpl),
      supabase: supa.client,
      appId: "123",
      maxPerRun: 2,
    });

    expect(summary.reports.downloads).toMatchObject({ processed: 2, skipped: 0 });
    expect(marks().map((m) => (m as { instance_id: string }).instance_id)).toEqual(["d1", "d2"]);
  });
});
