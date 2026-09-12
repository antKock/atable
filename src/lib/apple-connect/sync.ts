// Synchronisation quotidienne App Store Connect → app_store_daily (042).
//
// Idempotente par instance : Apple publie, pour chaque rapport, une instance
// DAILY immuable par jour de traitement (J = données de J-1). Toute instance
// absente de app_store_sync_instances est téléchargée, agrégée et intégrée
// via app_store_daily_replace (remplacement atomique des colonnes du rapport
// pour le jour) ; les connues sont sautées. Le premier passage rattrape donc
// tout l'historique disponible du flux ONGOING, les suivants ne font que J-1.
//
// Un échec de téléchargement lève (le moniteur Sentry passe en erreur) mais
// les instances déjà intégrées restent acquises : le passage suivant reprend.

import type { DbClient } from "@/lib/supabase/server";
import {
  type AppleConnectClient,
  findOngoingRequestId,
  findReportId,
  listDailyInstances,
} from "@/lib/apple-connect/client";
import {
  REPORT_DOWNLOADS,
  REPORT_ENGAGEMENT,
  type ReportKind,
  aggregateDownloads,
  aggregateEngagement,
  expectedDataDay,
  parseTsv,
} from "@/lib/apple-connect/reports";

export type SyncSummary = {
  requestId: string;
  reports: Record<ReportKind, { reportId: string; instances: number; processed: number; skipped: number; days: string[] }>;
};

const REPORTS: { kind: ReportKind; name: string }[] = [
  { kind: "downloads", name: REPORT_DOWNLOADS },
  { kind: "engagement", name: REPORT_ENGAGEMENT },
];

type Rows = Record<string, unknown>[];

function aggregate(kind: ReportKind, tsv: string): Map<string, Rows> {
  const rows = parseTsv(tsv);
  return kind === "downloads"
    ? (aggregateDownloads(rows) as Map<string, Rows>)
    : (aggregateEngagement(rows) as Map<string, Rows>);
}

export async function syncAppStore(opts: {
  client: AppleConnectClient;
  supabase: DbClient;
  appId: string;
  /** Plafond d'instances intégrées par rapport et par passage (rattrapage borné). */
  maxPerRun?: number;
}): Promise<SyncSummary> {
  const { client, supabase, appId } = opts;
  const maxPerRun = opts.maxPerRun ?? 120;

  const requestId = await findOngoingRequestId(client, appId);

  const { data: seenRows, error: seenError } = await supabase
    .from("app_store_sync_instances")
    .select("instance_id");
  if (seenError) throw new Error(`app_store_sync_instances: ${seenError.message}`);
  const seen = new Set((seenRows ?? []).map((r: { instance_id: string }) => r.instance_id));

  const summary: SyncSummary = {
    requestId,
    reports: {
      downloads: { reportId: "", instances: 0, processed: 0, skipped: 0, days: [] },
      engagement: { reportId: "", instances: 0, processed: 0, skipped: 0, days: [] },
    },
  };

  for (const { kind, name } of REPORTS) {
    const reportId = await findReportId(client, requestId, name);
    const instances = await listDailyInstances(client, reportId);
    const out = summary.reports[kind];
    out.reportId = reportId;
    out.instances = instances.length;

    for (const inst of instances) {
      if (seen.has(inst.id)) {
        out.skipped += 1;
        continue;
      }
      if (out.processed >= maxPerRun) break;

      const tsv = await client.downloadInstance(inst.id);
      const byDay = aggregate(kind, tsv);
      // Instance sans ligne (jour vide côté Apple) : on remet le jour attendu
      // à zéro pour ce rapport — l'absence de données EST la donnée.
      const days = byDay.size > 0 ? [...byDay.keys()].sort() : [expectedDataDay(inst.processingDate)];
      let rowCount = 0;
      for (const day of days) {
        const rows = byDay.get(day) ?? [];
        rowCount += rows.length;
        const { error } = await supabase.rpc("app_store_daily_replace", {
          p_day: day,
          p_report: kind,
          p_rows: rows,
        });
        if (error) throw new Error(`app_store_daily_replace(${day}, ${kind}): ${error.message}`);
      }

      const { error: markError } = await supabase.from("app_store_sync_instances").insert({
        instance_id: inst.id,
        report: kind,
        processing_date: inst.processingDate,
        data_days: days,
        row_count: rowCount,
      });
      if (markError) throw new Error(`app_store_sync_instances insert: ${markError.message}`);

      seen.add(inst.id);
      out.processed += 1;
      out.days.push(...days);
    }
  }

  return summary;
}
