import { describe, it, expect } from "vitest";
import { parseTsv, aggregateDownloads, aggregateEngagement, expectedDataDay } from "./reports";

const DL_HEADER =
  "Date\tApp Name\tApp Apple Identifier\tDownload Type\tApp Version\tDevice\tPlatform Version\tSource Type\tPage Type\tPre-Order\tTerritory\tCounts";
const dl = (date: string, type: string, source: string, counts: number) =>
  [date, "Mijote", "6772487648", type, "1.3", "iPhone", "iOS 26.6", source, "No page", "", "FR", counts].join("\t");

const ENG_HEADER =
  "Date\tApp Name\tApp Apple Identifier\tEvent\tPage Type\tPage Title\tSource Type\tSource Info\tCampaign\tEngagement Type\tDevice\tPlatform Version\tTerritory\tCounts\tUnique Counts";
const eng = (date: string, event: string, source: string, info: string, counts: number, uniq: number) =>
  [date, "Mijote", "6772487648", event, "Product page", "Default product page", source, info, "", "", "iPhone", "iOS 26.6", "FR", counts, uniq].join("\t");

describe("parseTsv", () => {
  it("indexe les cellules par en-tête et ignore les lignes vides", () => {
    const rows = parseTsv(`${DL_HEADER}\n${dl("2026-09-09", "First-time download", "App Store search", 3)}\n\n`);
    expect(rows).toHaveLength(1);
    expect(rows[0]["Download Type"]).toBe("First-time download");
    expect(rows[0]["Counts"]).toBe("3");
  });

  it("saute l'en-tête répété quand plusieurs segments sont concaténés", () => {
    const rows = parseTsv(
      [DL_HEADER, dl("2026-09-09", "Redownload", "App referrer", 1), DL_HEADER, dl("2026-09-09", "Redownload", "App referrer", 2)].join("\n"),
    );
    expect(rows).toHaveLength(2);
  });

  it("rend une liste vide pour un fichier vide", () => {
    expect(parseTsv("")).toEqual([]);
  });
});

describe("aggregateDownloads", () => {
  it("regroupe par jour et source, en séparant first-time / redownload / mises à jour", () => {
    const rows = parseTsv(
      [
        DL_HEADER,
        dl("2026-09-09", "First-time download", "App Store search", 1),
        dl("2026-09-09", "First-time download", "App Store search", 3),
        dl("2026-09-09", "Auto-update", "App Store search", 4),
        dl("2026-09-09", "Manual update", "App Store search", 2),
        dl("2026-09-09", "Redownload", "App referrer", 2),
        dl("2026-09-09", "First-time download", "App referrer", 2),
        dl("2026-09-10", "First-time download", "App Store search", 4),
      ].join("\n"),
    );
    const agg = aggregateDownloads(rows);
    expect([...agg.keys()]).toEqual(["2026-09-09", "2026-09-10"]);
    expect(agg.get("2026-09-09")).toEqual([
      { source_type: "App Store search", source_info: "", dl_first_time: 4, dl_redownload: 0, dl_update: 6 },
      { source_type: "App referrer", source_info: "", dl_first_time: 2, dl_redownload: 2, dl_update: 0 },
    ]);
    expect(agg.get("2026-09-10")).toEqual([
      { source_type: "App Store search", source_info: "", dl_first_time: 4, dl_redownload: 0, dl_update: 0 },
    ]);
  });

  it("ignore les lignes sans date valide et les compteurs illisibles", () => {
    const rows = parseTsv([DL_HEADER, dl("n/a", "First-time download", "App Store search", 9), dl("2026-09-09", "First-time download", "App Store search", NaN)].join("\n"));
    const agg = aggregateDownloads(rows);
    expect(agg.get("2026-09-09")?.[0].dl_first_time).toBe(0);
    expect(agg.has("n/a")).toBe(false);
  });

  it("remplace une source vide par « Unavailable »", () => {
    const rows = parseTsv([DL_HEADER, dl("2026-09-09", "First-time download", "", 2)].join("\n"));
    expect(aggregateDownloads(rows).get("2026-09-09")?.[0].source_type).toBe("Unavailable");
  });
});

describe("aggregateEngagement", () => {
  it("garde le referrer (Source Info) comme clé distincte et cumule impressions / vues / taps", () => {
    const rows = parseTsv(
      [
        ENG_HEADER,
        eng("2026-09-08", "Impression", "App Store search", "", 21, 16),
        eng("2026-09-08", "Impression", "App Store search", "", 5, 4),
        eng("2026-09-08", "Page view", "App Store search", "", 15, 15),
        eng("2026-09-08", "Page view", "App referrer", "com.openai.chat", 15, 15),
        eng("2026-09-08", "Tap", "App Store browse", "", 6, 6),
      ].join("\n"),
    );
    const agg = aggregateEngagement(rows);
    expect(agg.get("2026-09-08")).toEqual([
      { source_type: "App Store search", source_info: "", eng_impressions: 26, eng_impressions_uniq: 20, eng_page_views: 15, eng_page_views_uniq: 15, eng_taps: 0 },
      { source_type: "App referrer", source_info: "com.openai.chat", eng_impressions: 0, eng_impressions_uniq: 0, eng_page_views: 15, eng_page_views_uniq: 15, eng_taps: 0 },
      { source_type: "App Store browse", source_info: "", eng_impressions: 0, eng_impressions_uniq: 0, eng_page_views: 0, eng_page_views_uniq: 0, eng_taps: 6 },
    ]);
  });
});

describe("expectedDataDay", () => {
  it("est la veille de la date de traitement (Apple livre J-1)", () => {
    expect(expectedDataDay("2026-09-10")).toBe("2026-09-09");
    expect(expectedDataDay("2026-09-01")).toBe("2026-08-31");
  });
});
