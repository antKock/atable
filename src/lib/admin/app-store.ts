// Section « 00 — Acquisition App Store » du dashboard : mise en forme des
// lignes app_store_daily (042) — tunnel complet impressions → fiche →
// téléchargements → essais démo → carnets, série quotidienne, origine des
// téléchargements. Module pur (pas d'I/O) ; la lecture Supabase est dans
// queries.ts.

import { METRIC_EPOCHS, PRODUCT_EVENTS, clampWindow, windowLabel } from "@/lib/admin/epochs";

export type AppStoreDailyRow = {
  day: string;
  source_type: string;
  source_info: string;
  dl_first_time: number;
  dl_redownload: number;
  dl_update: number;
  eng_impressions: number;
  eng_impressions_uniq: number;
  eng_page_views: number;
  eng_page_views_uniq: number;
  eng_taps: number;
};

export type AppStoreDay = {
  day: string;
  label: string;
  downloads: number;
  redownloads: number;
  updates: number;
  impressions: number;
  pageViews: number;
};

export type AppStoreSource = { label: string; downloads: number; impressions: number; pageViews: number };

/** Libellés des sources Apple (valeurs stockées telles quelles, jamais traduites en base). */
const SOURCE_LABELS: Record<string, string> = {
  "App Store search": "Recherche App Store",
  "App Store browse": "Navigation App Store",
  "App referrer": "Depuis une app",
  "Web referrer": "Depuis le web",
  "Institutional purchase": "Achat institutionnel",
  Unavailable: "Indéterminé",
};

/** Referrers connus (bundle id / domaine → nom lisible). */
const REFERRER_LABELS: Record<string, string> = {
  "com.openai.chat": "ChatGPT",
  "com.apple.mobilesafari": "Safari",
  "com.google.chrome.ios": "Chrome",
  "com.apple.MobileSMS": "Messages",
  "com.burbn.instagram": "Instagram",
  "com.facebook.Messenger": "Messenger",
  "net.whatsapp.WhatsApp": "WhatsApp",
};

export function sourceLabel(sourceType: string, sourceInfo: string): string {
  const base = SOURCE_LABELS[sourceType] ?? sourceType;
  if (!sourceInfo) return base;
  const ref = REFERRER_LABELS[sourceInfo] ?? sourceInfo;
  return `${base} · ${ref}`;
}

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown) => Number(v) || 0;

function dayGrid(days: number, today: Date): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    return ISO(d);
  });
}

function shortLabel(isoDay: string): string {
  const d = new Date(isoDay + "T00:00:00Z");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
}

export type AppStoreShape = ReturnType<typeof shapeAppStore>;

/**
 * @param rows        lignes app_store_daily (toute fenêtre ≥ max(days, 30))
 * @param days        fenêtre affichée (période sélectionnée)
 * @param lastSyncAt  dernier passage du cron (max synced_at) ou null
 * @param demo        essais/conversions démo sur la même fenêtre 30 j (funnel 01)
 */
export function shapeAppStore(
  rows: AppStoreDailyRow[],
  opts: { days: number; today: Date; lastSyncAt: string | null; demo: { trials: number; conversions: number } },
) {
  const { days, today } = opts;
  const summaryWindow = clampWindow(30, "appStoreDaily", today);
  const from30 = new Date(today);
  from30.setUTCDate(from30.getUTCDate() - summaryWindow.days);
  const from30Iso = ISO(from30);

  // ---- série quotidienne (zéro-remplie sur la période) ----
  const byDay = new Map<string, AppStoreDay>();
  for (const r of rows) {
    let d = byDay.get(r.day);
    if (!d) byDay.set(r.day, (d = { day: r.day, label: shortLabel(r.day), downloads: 0, redownloads: 0, updates: 0, impressions: 0, pageViews: 0 }));
    d.downloads += num(r.dl_first_time);
    d.redownloads += num(r.dl_redownload);
    d.updates += num(r.dl_update);
    d.impressions += num(r.eng_impressions);
    d.pageViews += num(r.eng_page_views);
  }
  const daily: AppStoreDay[] = dayGrid(days, today).map(
    (iso) => byDay.get(iso) ?? { day: iso, label: shortLabel(iso), downloads: 0, redownloads: 0, updates: 0, impressions: 0, pageViews: 0 },
  );

  // ---- tunnel 30 j (clampé à la naissance de la mesure) ----
  const last30 = rows.filter((r) => r.day >= from30Iso);
  const sum = (key: keyof AppStoreDailyRow) => last30.reduce((s, r) => s + num(r[key]), 0);
  const impressions = sum("eng_impressions");
  const pageViews = sum("eng_page_views");
  const downloads = sum("dl_first_time");
  const redownloads = sum("dl_redownload");
  const updates = sum("dl_update");
  const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
  const funnel = [
    { label: "Impressions (recherche & navigation)", value: impressions, pct: 100 },
    { label: "Vues de fiche", value: pageViews, pct: pct(pageViews, impressions) },
    { label: "Premiers téléchargements", value: downloads, pct: pct(downloads, impressions) },
    { label: "Essais démo (app + web)", value: opts.demo.trials, pct: pct(opts.demo.trials, impressions) },
    { label: "Conversions — 1er carnet", value: opts.demo.conversions, pct: pct(opts.demo.conversions, impressions) },
  ];

  // ---- origine des téléchargements / impressions (30 j) ----
  const bySource = new Map<string, AppStoreSource>();
  for (const r of last30) {
    const label = sourceLabel(r.source_type, r.source_info);
    let s = bySource.get(label);
    if (!s) bySource.set(label, (s = { label, downloads: 0, impressions: 0, pageViews: 0 }));
    s.downloads += num(r.dl_first_time);
    s.impressions += num(r.eng_impressions);
    s.pageViews += num(r.eng_page_views);
  }
  const sources = [...bySource.values()]
    .filter((s) => s.downloads + s.impressions + s.pageViews > 0)
    .sort((a, b) => b.downloads - a.downloads || b.impressions - a.impressions);

  // ---- repères ----
  const windowStartIso = daily[0]?.day ?? ISO(today);
  const listingMarker = PRODUCT_EVENTS.appStoreListingV2 >= windowStartIso ? shortLabel(PRODUCT_EVENTS.appStoreListingV2) : null;
  const notMeasured =
    windowStartIso < METRIC_EPOCHS.appStoreDaily ? { from: daily[0].label, to: shortLabel(METRIC_EPOCHS.appStoreDaily) } : null;
  const lastDay = rows.reduce<string | null>((m, r) => (m == null || r.day > m ? r.day : m), null);

  return {
    daily,
    funnel,
    sources,
    totals: { impressions, pageViews, downloads, redownloads, updates },
    rates: {
      impressionsToDownloadPct: Math.round(pct(downloads, impressions)),
      downloadToCarnetPct: Math.round(pct(opts.demo.conversions, downloads)),
    },
    window: windowLabel(30, "appStoreDaily", today),
    listingMarker,
    notMeasured,
    lastDay,
    lastDayLabel: lastDay ? shortLabel(lastDay) : null,
    lastSyncAt: opts.lastSyncAt,
    // Jour et heure séparés : la tuile BigStats affiche le jour en grand, l'heure en indice.
    lastSyncLabel: opts.lastSyncAt
      ? new Date(opts.lastSyncAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" })
      : null,
    lastSyncTime: opts.lastSyncAt
      ? new Date(opts.lastSyncAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
      : null,
    // Cron muet depuis plus de 2 jours (ou jamais passé) : à surveiller.
    syncStale: !opts.lastSyncAt || today.getTime() - new Date(opts.lastSyncAt).getTime() > 2 * 86_400_000,
    hasData: rows.length > 0,
  };
}
