import { describe, it, expect } from "vitest";
import { assembleV3, type RawV3, type HealthRow } from "./assemble";
import type { Person } from "./people";
import { renderDigest } from "./digest";

const NOW = new Date("2026-09-12T08:00:00Z"); // samedi → dernière semaine close : 31/08 → 06/09

function person(over: Partial<Person> & { created_at: string }): Person {
  return {
    id: over.created_at,
    display_name: null, has_email: false, named: false, via_demo: false, first_platform: "ios", channel: "ios",
    carnets: 1, guest_of: 0, first_method: "url", first_recipe_at: over.created_at, recipes_7d: 3, recipes_28d: 2, recipes_total: 5,
    views_28d: 0, views_total: 0, returned_7d: true, active_m1: false, active_m2: false, active_m3: false,
    active_28d: true, active_prev28: false, active_days_28d: 2, last_active_day: "2026-09-10", ...over,
  };
}

const health: HealthRow = {
  ai_calls: 100, recipes_created: 40, recipes_enriched: 40, recipes_failed: 0, recipes_pending_stale: 0,
  demo_seed_fr: 30, demo_seed_en: 30, last_rollup: "2026-09-12T03:00:00Z", last_app_store_sync: "2026-09-12T09:04:00Z",
  ai_cost_usd: 3.5, ai_cost_demo_usd: 0.6, demo_trials: 22, demo_frozen_hits: 2, demo_ai_calls: 19, demo_recipes: 11,
  recovery_sent: 6, recovery_used: 4, merge_used: 1, tokens_burned: 0,
};

function raw(over: Partial<RawV3> = {}): RawV3 {
  const people = [
    person({ created_at: "2026-06-20T10:00:00Z", active_m1: true, channel: "web" }),
    person({ created_at: "2026-07-05T10:00:00Z", active_m1: false }),
    person({ created_at: "2026-08-28T10:00:00Z" }),
    person({ created_at: "2026-09-02T10:00:00Z", channel: "invite" }),
    person({ created_at: "2026-09-03T10:00:00Z", recipes_7d: 1, returned_7d: false, first_method: "photo" }),
  ];
  return {
    people,
    weeklyActive: [
      { week_end: "2026-09-06", cohort_month: "2026-06-01", active: 1, engaged: 1 },
      { week_end: "2026-09-06", cohort_month: "2026-09-01", active: 2, engaged: 1 },
      { week_end: "2026-08-09", cohort_month: "2026-06-01", active: 1, engaged: 0 },
    ],
    weeklyRecipes: [
      { week_start: "2026-08-31", source: "url", recipes: 6 },
      { week_start: "2026-08-31", source: "photo", recipes: 2 },
      { week_start: "2026-08-03", source: "url", recipes: 4 },
    ],
    demo: [{ platform: "ios", trials: 20, conversions: 8 }, { platform: "web", trials: 10, conversions: 1 }],
    health,
    appStore: [
      { day: "2026-09-01", source_type: "App Store search", source_info: "", dl_first_time: 7, dl_redownload: 0, dl_update: 2, eng_impressions: 100, eng_impressions_uniq: 80, eng_page_views: 10, eng_page_views_uniq: 9, eng_taps: 0 },
      { day: "2026-09-02", source_type: "App referrer", source_info: "com.openai.chat", dl_first_time: 2, dl_redownload: 0, dl_update: 0, eng_impressions: 0, eng_impressions_uniq: 0, eng_page_views: 3, eng_page_views_uniq: 3, eng_taps: 0 },
      { day: "2026-08-05", source_type: "App Store search", source_info: "", dl_first_time: 3, dl_redownload: 0, dl_update: 0, eng_impressions: 60, eng_impressions_uniq: 50, eng_page_views: 0, eng_page_views_uniq: 0, eng_taps: 0 },
    ],
    sharing: { links: 5, links_dated_estimate: true, copies: 2 },
    carnets: [
      { id: "a", name: "A", created_at: "2026-06-01", origin: "landing", members: 2, guests: 0, recipes: 10, shared_links: 1, last_active_day: "2026-09-10" },
      { id: "b", name: "B", created_at: "2026-07-01", origin: "demo_conversion", members: 1, guests: 1, recipes: 4, shared_links: 0, last_active_day: null },
      { id: "c", name: "C", created_at: "2026-08-01", origin: "landing", members: 1, guests: 0, recipes: 1, shared_links: 0, last_active_day: null },
    ],
    billedUsd: 3.7,
    demoSeedMin: 30,
    now: NOW,
    ...over,
  };
}

describe("assembleV3", () => {
  const d = assembleV3(raw());

  it("fenêtres : dernière semaine close et 4 semaines vs 4 précédentes", () => {
    expect(d.windows.endSunday).toBe("2026-09-06");
    expect(d.windows.cur4).toEqual({ from: "2026-08-10", to: "2026-09-06" });
    expect(d.windows.prev4).toEqual({ from: "2026-07-13", to: "2026-08-09" });
  });

  it("North Star = actifs 28 j à la fin de la dernière semaine close, delta vs 4 semaines plus tôt", () => {
    expect(d.overview.northStar).toMatchObject({ value: 3, engaged: 2, total: 5, delta: 2, fourWeeksAgo: 1 });
    expect(d.overview.northStar.series).toHaveLength(12);
    expect(d.overview.northStar.series[11]).toBe(3);
  });

  it("tuiles : nouvelles personnes par canal, activation, M1 glissante, recettes, coût", () => {
    const byId = Object.fromEntries(d.overview.tiles.map((t) => [t.id, t]));
    expect(byId.new.value).toBe("3"); // 28/08, 02/09, 03/09
    expect(byId.new.compare).toContain("vs 0");
    expect(byId.new.compare).toContain("2 par l'App Store");
    expect(byId.new.compare).toContain("1 par invitation");
    // Activation : arrivées des 4 semaines closes finissant le 30/08, jugeables → 28/08 (activée)
    expect(byId.activation.value).toBe("100 %");
    expect(byId.activation.fragile).toBe(true);
    // M1 glissante : fenêtre 15/06 → 12/07 → 20/06 (active) et 05/07 (inactive)
    expect(byId.m1.value).toBe("50 %");
    expect(byId.m1.compare).toContain("1 / 2");
    expect(byId.recipes.value).toBe("2,7"); // 8 recettes / 3 actifs
    expect(byId.cost.value).toBe("1,17"); // 3,5 $ / 3
  });

  it("santé : tout au vert avec des crons récents et le seed complet", () => {
    expect(d.overview.health.ok).toBe(true);
    const bad = assembleV3(raw({ health: { ...health, last_app_store_sync: "2026-09-09T09:00:00Z", recipes_failed: 2 } }));
    expect(bad.overview.health.ok).toBe(false);
    expect(bad.overview.health.crons.ok).toBe(false);
    expect(bad.overview.health.pipeline.ok).toBe(false);
  });

  it("acquisition : App Store sur 4 sem., sources nommées, démo par plateforme", () => {
    expect(d.acquisition.appStore).toMatchObject({ impressions: 100, pageViews: 13, downloads: 9, updates: 2, firstOpenIos: 20 });
    expect(d.acquisition.appStore.sources).toEqual([{ label: "Recherche App Store", downloads: 7 }, { label: "Depuis une app · ChatGPT", downloads: 2 }]);
    expect(d.acquisition.demo.ios).toMatchObject({ n: 8, total: 20, pct: 40 });
    expect(d.acquisition.weekly).toHaveLength(12);
    expect(d.acquisition.weekly[11]).toMatchObject({ label: "31/08", ios: 1, invite: 1, total: 2 });
  });

  it("activation par première méthode et rétention (table + courbes)", () => {
    expect(d.activation.byMethod[0]).toMatchObject({ label: "URL" });
    expect(d.retention.cohorts.map((c) => c.month)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(d.retention.cohorts[0].m1.r.n).toBe(1);
    expect(d.retention.curves).toEqual([]); // cohortes < 5 personnes
    expect(d.retention.cakeKeys).toEqual(["2026-06", "2026-09"]);
  });

  it("engagement : mix des méthodes en %, partage, carnets partagés", () => {
    const last = d.engage.methodMix[11];
    expect(last).toMatchObject({ label: "31/08", url: 75, photo: 25, total: 8 });
    expect(d.engage.methodMix.every((r) => r.total === 0 || ["url", "photo", "voice", "manual", "shared", "unknown"].reduce((a, k) => a + Number(r[k]), 0) === 100)).toBe(true);
    expect(d.engage.sharing).toMatchObject({ links: 5, copies: 2, estimate: true });
    expect(d.engage.sharedCarnets).toBe(2);
    expect(d.engage.carnetsWithGuests).toBe(1);
  });

  it("« ce qui a bougé » : au plus 3 phrases, en clair", () => {
    expect(d.overview.moved.length).toBeGreaterThan(0);
    expect(d.overview.moved.length).toBeLessThanOrEqual(3);
    expect(d.overview.moved[0]).toMatch(/nouvelle/);
  });
});

describe("renderDigest", () => {
  it("rend sujet, texte et HTML à partir du bloc 1", () => {
    const d = assembleV3(raw());
    const out = renderDigest(d.overview, { weekLabel: "semaine du 31 août au 6 sept. (2026-W36)", statsUrl: "https://mijote.example/admin/stats" });
    expect(out.subject).toBe("Mijote — semaine du 31 août au 6 sept. (2026-W36) : 3 cuisiniers actifs (+2)");
    expect(out.text).toContain("Cuisiniers actifs (28 j) : 3 (+2 vs 4 semaines plus tôt, 1)");
    expect(out.text).toContain("Nouvelles personnes · 4 sem. : 3");
    expect(out.text).toContain("Santé : tout est au vert");
    expect(out.text).toContain("https://mijote.example/admin/stats");
    expect(out.html).toContain("<!doctype html>");
    expect(out.html).toContain("Ouvrir le dashboard");
    expect(out.html).not.toContain("<script");
  });
  it("signale la santé dans le sujet quand un voyant est rouge", () => {
    const d = assembleV3(raw({ health: { ...health, demo_seed_fr: 12 } }));
    const out = renderDigest(d.overview, { weekLabel: "S36", statsUrl: "x" });
    expect(out.subject).toContain("⚠ santé");
    expect(out.text).toContain("démo — 12 recettes seed FR");
  });
});
