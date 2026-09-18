import { describe, it, expect } from "vitest";
import { assembleV3, type RawV3, type HealthRow } from "./assemble";
import type { Person } from "./people";
import { renderDigest } from "./digest";

const NOW = new Date("2026-09-12T08:00:00Z"); // samedi → dernière semaine close : 31/08 → 06/09

function person(over: Partial<Person> & { created_at: string }): Person {
  return {
    id: over.created_at,
    display_name: null,
    has_email: false,
    named: false,
    via_demo: false,
    first_platform: "ios",
    channel: "ios",
    carnets: 1,
    guest_of: 0,
    first_method: "url",
    first_recipe_at: over.created_at,
    recipes_7d: 3,
    recipes_28d: 2,
    recipes_total: 5,
    views_28d: 0,
    views_total: 0,
    returned_7d: true,
    active_m1: false,
    active_m2: false,
    active_m3: false,
    active_28d: true,
    active_prev28: false,
    onboarding_variant: null,
    active_days_28d: 2,
    last_active_day: "2026-09-10",
    ...over,
  };
}

const health: HealthRow = {
  ai_calls: 100,
  recipes_created: 40,
  recipes_enriched: 40,
  recipes_failed: 0,
  recipes_pending_stale: 0,
  demo_seed_fr: 30,
  demo_seed_en: 30,
  last_rollup: "2026-09-12T03:00:00Z",
  last_app_store_sync: "2026-09-12T09:04:00Z",
  ai_cost_usd: 3.5,
  ai_cost_demo_usd: 0.6,
  demo_trials: 22,
  demo_frozen_hits: 2,
  demo_ai_calls: 19,
  demo_recipes: 11,
  recovery_sent: 6,
  recovery_used: 4,
  merge_used: 1,
  tokens_burned: 0,
};

function raw(over: Partial<RawV3> = {}): RawV3 {
  const people = [
    person({ created_at: "2026-06-20T10:00:00Z", active_m1: true, channel: "web" }),
    person({ created_at: "2026-07-05T10:00:00Z", active_m1: false }),
    person({ created_at: "2026-08-28T10:00:00Z" }),
    person({ created_at: "2026-09-02T10:00:00Z", channel: "invite" }),
    person({
      created_at: "2026-09-03T10:00:00Z",
      recipes_7d: 1,
      returned_7d: false,
      first_method: "photo",
    }),
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
    demo: [
      { platform: "ios", trials: 20, conversions: 8 },
      { platform: "web", trials: 10, conversions: 1 },
    ],
    abOnboarding: [],
    backupLastAt: "2026-09-12T02:30:03Z",
    edgeErrors: [],
    instagramReads: [],
    apifyUsage: { usedUsd: 0.5, limitUsd: 5, cycleEnd: "2026-10-17T23:59:59.999Z" },
    health,
    appStore: [
      {
        day: "2026-09-01",
        source_type: "App Store search",
        source_info: "",
        dl_first_time: 7,
        dl_redownload: 0,
        dl_update: 2,
        eng_impressions: 100,
        eng_impressions_uniq: 80,
        eng_page_views: 10,
        eng_page_views_uniq: 9,
        eng_taps: 0,
      },
      {
        day: "2026-09-02",
        source_type: "App referrer",
        source_info: "com.openai.chat",
        dl_first_time: 2,
        dl_redownload: 0,
        dl_update: 0,
        eng_impressions: 0,
        eng_impressions_uniq: 0,
        eng_page_views: 3,
        eng_page_views_uniq: 3,
        eng_taps: 0,
      },
      {
        day: "2026-08-05",
        source_type: "App Store search",
        source_info: "",
        dl_first_time: 3,
        dl_redownload: 0,
        dl_update: 0,
        eng_impressions: 60,
        eng_impressions_uniq: 50,
        eng_page_views: 0,
        eng_page_views_uniq: 0,
        eng_taps: 0,
      },
    ],
    sharing: { links: 5, links_dated_estimate: true, copies: 2 },
    carnets: [
      {
        id: "a",
        name: "A",
        created_at: "2026-06-01",
        origin: "landing",
        members: 2,
        guests: 0,
        recipes: 10,
        shared_links: 1,
        last_active_day: "2026-09-10",
      },
      {
        id: "b",
        name: "B",
        created_at: "2026-07-01",
        origin: "demo_conversion",
        members: 1,
        guests: 1,
        recipes: 4,
        shared_links: 0,
        last_active_day: null,
      },
      {
        id: "c",
        name: "C",
        created_at: "2026-08-01",
        origin: "landing",
        members: 1,
        guests: 0,
        recipes: 1,
        shared_links: 0,
        last_active_day: null,
      },
    ],
    daily: Array.from({ length: 40 }, (_, i) => {
      const d = new Date("2026-09-11T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - i);
      const day = d.toISOString().slice(0, 10);
      // 7 derniers jours : 2 essais, 1 recette, 3 actifs / jour ; avant : 1, 0, 2.
      const recent = i < 7;
      return {
        day,
        trials: recent ? 2 : 1,
        trials_ios: recent ? 2 : 1,
        trials_web: 0,
        trials_android: 0,
        new_people: 0,
        recipes: recent ? 1 : 0,
        active_people: recent ? 3 : 2,
      };
    }),
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
    expect(d.overview.northStar).toMatchObject({
      value: 3,
      engaged: 2,
      total: 5,
      delta: 2,
      fourWeeksAgo: 1,
    });
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
    const bad = assembleV3(
      raw({
        health: { ...health, last_app_store_sync: "2026-09-09T09:00:00Z", recipes_failed: 2 },
      }),
    );
    expect(bad.overview.health.ok).toBe(false);
    expect(bad.overview.health.crons.ok).toBe(false);
    expect(bad.overview.health.pipeline.ok).toBe(false);
  });

  it("santé (#27) : sauvegarde > 26 h ou inconnue, et 5xx Traefik > 2 sur 24 h → rouge", () => {
    expect(d.overview.health.backup).toMatchObject({ ok: true });
    expect(d.overview.health.edge).toMatchObject({ ok: true });
    const stale = assembleV3(raw({ backupLastAt: "2026-09-11T02:30:00Z" }));
    expect(stale.overview.health.backup.ok).toBe(false);
    expect(stale.overview.health.ok).toBe(false);
    const unknown = assembleV3(raw({ backupLastAt: null }));
    expect(unknown.overview.health.backup.ok).toBe(false);
    expect(unknown.overview.health.backup.detail).toMatch(/aucune sauvegarde/);
    const edge = assembleV3(
      raw({
        edgeErrors: [
          { day: "2026-09-10", traefik_5xx: 40 }, // hors fenêtre (hier + aujourd'hui)
          { day: "2026-09-11", traefik_5xx: 1 },
          { day: "2026-09-12", traefik_5xx: 2 },
        ],
      }),
    );
    expect(edge.overview.health.edge.ok).toBe(false);
    expect(edge.overview.health.edge.detail).toMatch(/^3 réponses 5xx/);
    const fine = assembleV3(raw({ edgeErrors: [{ day: "2026-09-12", traefik_5xx: 2 }] }));
    expect(fine.overview.health.edge.ok).toBe(true);
  });

  it("santé : Instagram rouge au-delà de 30 % de secours dès 5 lectures (cache hors ratio)", () => {
    expect(d.overview.health.instagram).toMatchObject({ ok: true });
    expect(d.overview.health.instagram.detail).toMatch(/aucune lecture/);
    const reads = (...paths: string[]) => paths.map((ig_path) => ({ ig_path }));
    // 2 secours sur 5 lectures (40 %) → rouge ; les `cache` ne comptent pas.
    const bad = assembleV3(
      raw({
        instagramReads: reads(
          "direct_embed",
          "direct_og",
          "direct_embed",
          "apify",
          "failed",
          "cache",
          "cache",
        ),
      }),
    );
    expect(bad.overview.health.instagram.ok).toBe(false);
    expect(bad.overview.health.instagram.detail).toMatch(/^2 lectures sur 5 .* \(40 %/);
    expect(bad.overview.health.ok).toBe(false);
    // 3 lectures dont 2 en secours : trop peu pour conclure.
    const few = assembleV3(raw({ instagramReads: reads("apify", "apify", "direct_embed") }));
    expect(few.overview.health.instagram.ok).toBe(true);
    // 1 secours sur 5 (20 %) → vert.
    const fine = assembleV3(
      raw({
        instagramReads: reads("direct_embed", "direct_embed", "direct_og", "direct_embed", "apify"),
      }),
    );
    expect(fine.overview.health.instagram.ok).toBe(true);
  });

  it("santé : crédit Apify rouge au-delà de 80 %, illisible = vert (pas d'alerte sur une API muette)", () => {
    expect(d.overview.health.apify).toMatchObject({ ok: true });
    const high = assembleV3(raw({ apifyUsage: { usedUsd: 4.2, limitUsd: 5, cycleEnd: null } }));
    expect(high.overview.health.apify.ok).toBe(false);
    expect(high.overview.health.apify.detail).toMatch(/^4\.20 \$ sur 5 \$ .*84 %/);
    const unknown = assembleV3(raw({ apifyUsage: null }));
    expect(unknown.overview.health.apify).toMatchObject({ ok: true });
    expect(unknown.overview.health.apify.detail).toMatch(/illisible/);
  });

  it("acquisition : App Store sur 4 sem., sources nommées, démo par plateforme", () => {
    expect(d.acquisition.appStore).toMatchObject({
      impressions: 100,
      pageViews: 13,
      downloads: 9,
      updates: 2,
      // 28 j d'essais démo iOS (avant l'époque du compteur 046) : 7 × 2 + 20 × 1
      firstOpenIos: 34,
    });
    expect(d.acquisition.appStore.sources).toEqual([
      { label: "Recherche App Store", downloads: 7 },
      { label: "Depuis une app · ChatGPT", downloads: 2 },
    ]);
    expect(d.acquisition.demo.ios).toMatchObject({ n: 8, total: 20, pct: 40 });
    expect(d.acquisition.weekly).toHaveLength(12);
    expect(d.acquisition.weekly[11]).toMatchObject({ label: "31/08", ios: 1, invite: 1, total: 2 });
  });

  it("activation par première méthode et rétention (table + courbes)", () => {
    expect(d.activation.byMethod[0]).toMatchObject({ label: "URL" });
    expect(d.retention.cohorts.map((c) => c.month)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(d.retention.cohorts[0].m1.r.n).toBe(1);
    expect(d.retention.curves).toEqual([]); // cohortes < 5 personnes
    expect(d.retention.cakeKeys).toEqual(["2026-06", "2026-09"]);
  });

  it("engagement : mix des méthodes en %, partage, carnets partagés", () => {
    const last = d.engage.methodMix[11];
    expect(last).toMatchObject({ label: "31/08", url: 75, photo: 25, total: 8 });
    expect(
      d.engage.methodMix.every(
        (r) =>
          r.total === 0 ||
          ["url", "photo", "voice", "manual", "shared", "unknown"].reduce(
            (a, k) => a + Number(r[k]),
            0,
          ) === 100,
      ),
    ).toBe(true);
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

describe("bloc 0 et funnel hebdo", () => {
  const d = assembleV3(raw());
  it("7 derniers jours : valeur J-7 → J-1, repère = médiane des 3 semaines d'avant, 14 barres closes + le jour en cours", () => {
    expect(d.overview.hotWindow).toEqual({ from: "2026-09-05", to: "2026-09-11" });
    expect(d.overview.hotToday).toBe("2026-09-12");
    const by = Object.fromEntries(d.overview.hot.map((h) => [h.id, h]));
    expect(by.trials).toMatchObject({ value: 14, ref: 7, trend: "up" });
    expect(by.recipes).toMatchObject({ value: 7, ref: 0, trend: "up" });
    expect(by.active).toMatchObject({ value: 3, ref: 2, trend: "up" });
    expect(by.trials.window).toEqual({ from: "2026-09-05", to: "2026-09-11" });
    // 14 jours clos (29/08 → 11/09) + la journée en cours, marquée partielle.
    expect(by.trials.bars).toHaveLength(15);
    expect(by.trials.bars[0].day).toBe("2026-08-29");
    expect(by.trials.bars[13].day).toBe("2026-09-11");
    expect(by.trials.bars[14]).toMatchObject({ day: "2026-09-12", partial: true, inWindow: false });
    // Médiane du même jour de semaine sur 4 semaines : essais = 1 avant les 7 derniers jours (2 ensuite)
    expect(by.trials.bars[13].ref).toBe(1); // 11/09 : 04/09 (2), 28/08, 21/08, 14/08 (1) → médiane 1
    expect(by.trials.bars[0].ref).toBe(1);
    expect(by.new.value).toBe(0); // new_people de la série quotidienne (0 ici)
  });

  it("App Store en retard : fenêtre recalée au dernier jour livré, jours suivants absents (pas zéro)", () => {
    const by = Object.fromEntries(d.overview.hot.map((h) => [h.id, h]));
    // Apple s'arrête au 02/09 : la fenêtre finit là, sinon 5 jours vides tireraient le total à 0.
    expect(by.downloads.window).toEqual({ from: "2026-08-27", to: "2026-09-02" });
    expect(by.downloads).toMatchObject({ value: 9, ref: 0, trend: "up" });
    expect(by.downloads.hint).toBe("7 jours arrêtés au 2 sept. — dernier jour livré par Apple");
    // Les jours non livrés valent null (barre grise), pas 0.
    expect(by.downloads.bars.filter((b) => b.value === null).map((b) => b.day)).toEqual([
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
    ]);
    expect(by.downloads.bars.reduce((a, b) => a + (b.value ?? 0), 0)).toBe(9);
  });
  it("funnel App Store par semaine : comptes et taux, grisé sous 20 téléchargements", () => {
    const w = d.acquisition.appStore.funnelWeekly;
    expect(w).toHaveLength(12);
    const last = w[11];
    expect(last).toMatchObject({
      label: "31/08",
      impressions: 100,
      downloads: 9,
      carnets: 1,
      fragile: true,
    });
    expect(last.imprToDl).toBe(9);
    expect(last.opens).toBe(9); // 31/08 → 04/09 : 1 / jour, 05 et 06/09 : 2 / jour
    expect(last.dlToOpen).toBe(100);
    const empty = w[0];
    expect(empty.imprToDl).toBeNull();
  });
});

describe("A/B onboarding (#25)", () => {
  // Après l'époque du compteur (14/09) : « ouvertures iOS » = compteur du proxy,
  // plus les essais démo. Fenêtre du test = depuis abOnboardingStart (17/09),
  // dénominateur = affectations du shell iOS seules (migration 050).
  const NOW_AB = new Date("2026-09-26T08:00:00Z");
  const people = [
    person({ created_at: "2026-09-17T10:00:00Z", onboarding_variant: "b", recipes_7d: 1 }),
    person({
      created_at: "2026-09-17T10:00:00Z",
      onboarding_variant: "b",
      first_recipe_at: null,
      recipes_7d: 0,
    }),
    person({ created_at: "2026-09-17T10:00:00Z", onboarding_variant: "a", recipes_7d: 3 }),
    // Invitation : pas de bras, jamais comptée
    person({ created_at: "2026-09-17T10:00:00Z", onboarding_variant: null, channel: "invite" }),
    // Fenêtre J+7 encore ouverte, rien de franchi : comptée en carnet et « en cours »
    person({
      created_at: "2026-09-24T10:00:00Z",
      onboarding_variant: "b",
      first_recipe_at: null,
      recipes_7d: 0,
    }),
    // Avant la fenêtre : hors cohorte, comptée à part
    person({ created_at: "2026-09-15T10:00:00Z", onboarding_variant: "a" }),
  ];
  const dAb = assembleV3(
    raw({
      now: NOW_AB,
      people,
      abOnboarding: [
        // Avant la fenêtre : compte pour la tuile iOS, pas pour le test.
        {
          day: "2026-09-14",
          assigned_a: 3,
          assigned_b: 4,
          assigned_a_ios: 1,
          assigned_b_ios: 1,
          first_open_ios: 5,
        },
        {
          day: "2026-09-17",
          assigned_a: 6,
          assigned_b: 5,
          assigned_a_ios: 2,
          assigned_b_ios: 3,
          first_open_ios: 5,
        },
        {
          day: "2026-09-20",
          assigned_a: 2,
          assigned_b: 1,
          assigned_a_ios: 1,
          assigned_b_ios: 0,
          first_open_ios: 2,
        },
      ],
    }),
  );

  it("chaîne par bras : dénominateur iOS, étapes franchies et fenêtres en cours", () => {
    expect(dAb.activation.ab.since).toBe("2026-09-17");
    expect(dAb.activation.ab.arms).toEqual([
      {
        arm: "a",
        assigned: 3, // iOS seul : 2 (16/09) + 1 (20/09) ; le 14/09 est hors fenêtre
        assignedAll: 8,
        owners: 1,
        firstRecipe: { done: 1, pending: 0 },
        activated: { done: 1, pending: 0 }, // 3 recettes + retour (fixture)
        activeM1: { done: 0, pending: 1 }, // M1 pas encore atteinte
      },
      {
        arm: "b",
        assigned: 3,
        assignedAll: 6,
        owners: 3,
        firstRecipe: { done: 1, pending: 1 },
        activated: { done: 0, pending: 1 },
        activeM1: { done: 0, pending: 3 },
      },
    ]);
    // Arrivées d'avant la fenêtre : comptes seuls, sans dénominateur.
    expect(dAb.activation.ab.before).toEqual({ a: 1, b: 0 });
  });

  it("1ʳᵉ ouverture iOS : compteur du proxy après l'époque, essais démo avant", () => {
    // 28 j se terminant le 26/09 : 30/08 → 12/09 en essais démo (fixture : 05→11/09 = 2/j,
    // 30/08→04/09 = 1/j, 12/09 absent), puis le compteur (5 + 5 + 2).
    expect(dAb.acquisition.appStore.firstOpenIos).toBe(7 * 2 + 6 * 1 + 12);
    const w = dAb.acquisition.appStore.funnelWeekly;
    // semaine 14/09 → 20/09 : compteur 5 (14/09) + 5 (16/09) + 2 (20/09)
    expect(w[w.length - 1]).toMatchObject({ label: "14/09", opens: 12 });
  });
});

describe("renderDigest", () => {
  it("rend sujet, texte et HTML à partir du bloc 1", () => {
    const d = assembleV3(raw());
    const out = renderDigest(d.overview, {
      weekLabel: "semaine du 31 août au 6 sept. (2026-W36)",
      statsUrl: "https://mijote.example/admin/stats",
    });
    expect(out.subject).toBe(
      "Mijote — semaine du 31 août au 6 sept. (2026-W36) : 3 cuisiniers actifs (+2)",
    );
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
