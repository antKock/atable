import { describe, it, expect } from "vitest";
import { shapeAppStore, sourceLabel, type AppStoreDailyRow } from "./app-store";

const row = (day: string, over: Partial<AppStoreDailyRow> = {}): AppStoreDailyRow => ({
  day,
  source_type: "App Store search",
  source_info: "",
  dl_first_time: 0,
  dl_redownload: 0,
  dl_update: 0,
  eng_impressions: 0,
  eng_impressions_uniq: 0,
  eng_page_views: 0,
  eng_page_views_uniq: 0,
  eng_taps: 0,
  ...over,
});

const TODAY = new Date("2026-09-12T08:00:00Z");
const DEMO = { trials: 22, conversions: 7 };

describe("sourceLabel", () => {
  it("traduit la source Apple et nomme les referrers connus", () => {
    expect(sourceLabel("App Store search", "")).toBe("Recherche App Store");
    expect(sourceLabel("App referrer", "com.openai.chat")).toBe("Depuis une app · ChatGPT");
    expect(sourceLabel("App referrer", "com.example.unknown")).toBe("Depuis une app · com.example.unknown");
    expect(sourceLabel("Something new", "")).toBe("Something new");
  });
});

describe("shapeAppStore", () => {
  const rows = [
    row("2026-09-08", { dl_first_time: 5, dl_update: 2, eng_impressions: 21, eng_page_views: 5 }),
    row("2026-09-08", { source_type: "App referrer", dl_first_time: 2 }),
    row("2026-09-08", { source_type: "App referrer", source_info: "com.openai.chat", eng_page_views: 5 }),
    row("2026-09-09", { dl_first_time: 7, dl_redownload: 1, eng_impressions: 18 }),
    // Hors fenêtre 30 j (mais dans la période affichée si days ≥ 60)
    row("2026-07-30", { dl_first_time: 40 }),
  ];

  it("zéro-remplit la série sur la période et cumule les sources par jour", () => {
    const out = shapeAppStore(rows, { days: 7, today: TODAY, lastSyncAt: "2026-09-12T10:05:00Z", demo: DEMO });
    expect(out.daily).toHaveLength(7);
    expect(out.daily.map((d) => d.day)).toEqual(["2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12"]);
    expect(out.daily[2]).toMatchObject({ day: "2026-09-08", downloads: 7, updates: 2, impressions: 21, pageViews: 10 });
    expect(out.daily[3]).toMatchObject({ day: "2026-09-09", downloads: 7, redownloads: 1, impressions: 18 });
    expect(out.daily[6]).toMatchObject({ downloads: 0, impressions: 0 });
  });

  it("construit le tunnel 30 j en enchaînant Apple puis Mijote (essais, conversions)", () => {
    const out = shapeAppStore(rows, { days: 7, today: TODAY, lastSyncAt: null, demo: DEMO });
    expect(out.funnel.map((s) => [s.label, s.value, Math.round(s.pct)])).toEqual([
      ["Impressions (recherche & navigation)", 39, 100],
      ["Vues de fiche", 10, 26],
      ["Premiers téléchargements", 14, 36],
      ["Essais démo (app + web)", 22, 56],
      ["Conversions — 1er carnet", 7, 18],
    ]);
    // La ligne de juillet est hors des 30 j : pas dans les totaux.
    expect(out.totals).toEqual({ impressions: 39, pageViews: 10, downloads: 14, redownloads: 1, updates: 2 });
    expect(out.rates).toEqual({ impressionsToDownloadPct: 36, downloadToCarnetPct: 50 });
  });

  it("ventile l'origine des téléchargements, ChatGPT nommé, triée par téléchargements puis impressions", () => {
    const out = shapeAppStore(rows, { days: 7, today: TODAY, lastSyncAt: null, demo: DEMO });
    expect(out.sources).toEqual([
      { label: "Recherche App Store", downloads: 12, impressions: 39, pageViews: 5 },
      { label: "Depuis une app", downloads: 2, impressions: 0, pageViews: 0 },
      { label: "Depuis une app · ChatGPT", downloads: 0, impressions: 0, pageViews: 5 },
    ]);
  });

  it("pose le repère 1.3 et la zone non mesurée seulement quand la période les contient", () => {
    const short = shapeAppStore(rows, { days: 3, today: TODAY, lastSyncAt: null, demo: DEMO });
    expect(short.listingMarker).toBeNull();
    expect(short.notMeasured).toBeNull();

    const long = shapeAppStore(rows, { days: 60, today: TODAY, lastSyncAt: null, demo: DEMO });
    expect(long.listingMarker).toBe("6 sept.");
    expect(long.notMeasured).toEqual({ from: "15 juil.", to: "16 août" });
  });

  it("signale une synchro absente ou vieille de plus de 2 jours", () => {
    expect(shapeAppStore(rows, { days: 7, today: TODAY, lastSyncAt: null, demo: DEMO })).toMatchObject({ syncStale: true, lastSyncLabel: null });
    expect(shapeAppStore(rows, { days: 7, today: TODAY, lastSyncAt: "2026-09-09T10:00:00Z", demo: DEMO }).syncStale).toBe(true);
    const fresh = shapeAppStore(rows, { days: 7, today: TODAY, lastSyncAt: "2026-09-12T10:05:00Z", demo: DEMO });
    expect(fresh.syncStale).toBe(false);
    expect(fresh.lastSyncLabel).toBe("12 sept.");
    expect(fresh.lastSyncTime).toBe("12:05");
    expect(fresh.lastDayLabel).toBe("9 sept.");
  });

  it("sans aucune ligne : série vide, tunnel à zéro côté Apple, hasData faux", () => {
    const out = shapeAppStore([], { days: 7, today: TODAY, lastSyncAt: null, demo: DEMO });
    expect(out.hasData).toBe(false);
    expect(out.sources).toEqual([]);
    expect(out.funnel[0].value).toBe(0);
    expect(out.funnel[3].value).toBe(22);
    expect(out.lastDay).toBeNull();
  });
});
