// Assemblage pur du dashboard v3 à partir des lignes brutes (RPC 043 +
// app_store_daily). Aucune I/O : testable, et partagé par la page et le digest
// hebdo (bloc 1). Les lectures Supabase sont dans data.ts.

import {
  dayList,
  hotIndicator,
  num,
  pct1,
  weeklyActiveSeries,
  weeklyRecipesSeries,
} from "@/lib/admin/v3/sections";
import { sourceLabel } from "@/lib/admin/app-store";
import type { AppStoreDailyRow } from "@/lib/admin/app-store";
import {
  type Person,
  type Channel,
  CHANNEL_LABELS,
  METHOD_LABELS,
  abBeforeWindow,
  abOnboardingFunnel,
  activationByFirstMethod,
  activationFunnel,
  activationWeekly,
  cohortTable,
  engagement,
  newPeople,
  newPeopleWeekly,
  retentionCurves,
  rollingM1,
} from "@/lib/admin/v3/people";
import { type Ratio, deltaPts, nLabel, pctLabel, ratio } from "@/lib/admin/v3/ratio";
import {
  type Window,
  addDays,
  inWindow,
  iso,
  lastSunday,
  shortDate,
  weekStarts,
  weeksEnding,
} from "@/lib/admin/v3/weeks";
import { METRIC_EPOCHS, PRODUCT_EVENTS } from "@/lib/admin/epochs";

export type WeeklyActiveRow = {
  week_end: string;
  cohort_month: string;
  active: number;
  engaged: number;
};
export type WeeklyRecipesRow = { week_start: string; source: string; recipes: number };
export type DemoRow = { platform: string; trials: number; conversions: number };
export type HealthRow = {
  ai_calls: number;
  recipes_created: number;
  recipes_enriched: number;
  recipes_failed: number;
  recipes_pending_stale: number;
  demo_seed_fr: number;
  demo_seed_en: number;
  last_rollup: string | null;
  last_app_store_sync: string | null;
  ai_cost_usd: number;
  ai_cost_demo_usd: number;
  demo_trials: number;
  demo_frozen_hits: number;
  demo_ai_calls: number;
  demo_recipes: number;
  recovery_sent: number;
  recovery_used: number;
  merge_used: number;
  tokens_burned: number;
};
export type SharingRow = { links: number; links_dated_estimate: boolean; copies: number };
/** Affectations A/B et premières ouvertures iOS par jour (046). */
export type AbDailyRow = {
  day: string;
  assigned_a: number;
  assigned_b: number;
  /** Affectations du shell iOS natif (migration 050) : dénominateur du test. */
  assigned_a_ios: number;
  assigned_b_ios: number;
  first_open_ios: number;
};

export type DailyRow = {
  day: string;
  trials: number;
  trials_ios: number;
  trials_web: number;
  trials_android: number;
  new_people: number;
  recipes: number;
  active_people: number;
};
export type CarnetRow = {
  id: string;
  name: string;
  created_at: string;
  origin: string;
  members: number;
  guests: number;
  recipes: number;
  shared_links: number;
  last_active_day: string | null;
};

export type RawV3 = {
  people: Person[];
  weeklyActive: WeeklyActiveRow[];
  weeklyRecipes: WeeklyRecipesRow[];
  demo: DemoRow[];
  health: HealthRow;
  appStore: AppStoreDailyRow[];
  sharing: SharingRow;
  carnets: CarnetRow[];
  /** Série quotidienne (044), ≥ 91 jours, aujourd'hui inclus (partiel). */
  daily: DailyRow[];
  /** Affectations A/B + premières ouvertures iOS par jour (046), même fenêtre que appStore. */
  abOnboarding: AbDailyRow[];
  billedUsd: number | null;
  demoSeedMin: number;
  now: Date;
  /** Veilleur ops (#27) : dernière sauvegarde S3 de l'env (null = inconnue), 5xx Traefik par jour. */
  backupLastAt: string | null;
  edgeErrors: { day: string; traefik_5xx: number }[];
};

const WEEKS = 12;
const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

export type KpiTile = {
  id: string;
  label: string;
  /** Valeur principale (déjà formatée). */
  value: string;
  /** Unité affichée en petit à côté de la valeur. */
  unit?: string;
  /** Vrai si le % est fragile (N < 20) — affiché grisé. */
  fragile?: boolean;
  /** Info-bulle (marge d'erreur, définition courte). */
  title?: string;
  /** Ligne de comparaison (texte libre, déjà formaté). */
  compare: string;
  /** Variation : positive = bien. */
  trend?: "up" | "down" | "flat";
  bench?: string;
  spark?: number[];
};

export type HotBar = {
  day: string;
  /** null = la source n'a pas encore livré ce jour (Apple) → barre grise, pas un zéro. */
  value: number | null;
  /** Médiane du MÊME jour de semaine sur les 4 semaines précédentes (dimanche bas = normal ou pas ?). */
  ref: number;
  /** Jour en cours : données partielles, ni colorées par comparaison ni comptées dans la valeur. */
  partial: boolean;
  /** Fait partie des 7 jours de la valeur affichée. */
  inWindow: boolean;
};

export type HotIndicator = {
  id: string;
  label: string;
  /** Total (ou moyenne) des 7 jours clos de `window` ; null = aucune donnée. */
  value: number | null;
  /** Médiane des 3 fenêtres de 7 jours précédentes, même unité. */
  ref: number | null;
  trend: "up" | "down" | "flat" | null;
  /** 14 jours clos finissant à J-1, plus le jour en cours (`partial`). */
  bars: HotBar[];
  /** Fenêtre de la valeur : J-7 → J-1, recalée sur le dernier jour livré. */
  window: { from: string; to: string } | null;
  unit?: string;
  hint?: string;
};

export type StoreWeek = {
  weekStart: string;
  label: string;
  impressions: number;
  downloads: number;
  opens: number;
  carnets: number;
  imprToDl: number | null;
  dlToOpen: number | null;
  openToCarnet: number | null;
  fragile: boolean;
};

export type HealthLight = { ok: boolean; detail: string };
export type Health = {
  ok: boolean;
  pipeline: HealthLight;
  crons: HealthLight;
  demo: HealthLight;
  /** Sauvegarde Postgres nocturne (S3) : rouge au-delà de 26 h ou inconnue. */
  backup: HealthLight;
  /** Bord (Traefik) : réponses 5xx vues par le reverse proxy, hier + aujourd'hui. */
  edge: HealthLight;
};

/** Seuils du veilleur (#27), partagés avec /api/admin/health. */
export const BACKUP_MAX_AGE_H = 26;
export const EDGE_5XX_MAX_24H = 2;

function hoursSince(isoTs: string | null, now: Date): number | null {
  if (!isoTs) return null;
  return (now.getTime() - new Date(isoTs).getTime()) / 3_600_000;
}

function fmtTs(isoTs: string | null): string {
  if (!isoTs) return "jamais";
  return new Date(isoTs).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

const usd = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;

export function assembleV3(raw: RawV3) {
  const today = iso(raw.now);
  const endSunday = lastSunday(raw.now);
  const cur4: Window = weeksEnding(endSunday, 4);
  const prev4: Window = weeksEnding(addDays(endSunday, -28), 4);
  const starts12 = weekStarts(endSunday, WEEKS);
  const people = raw.people;

  // ---------------- séries hebdo actifs (sections.ts) ----------------
  const { activeByWeek, engagedByWeek, activeSeries, cake, cakeKeys, olderKey } =
    weeklyActiveSeries(raw.weeklyActive, starts12);
  const activeNow = activeByWeek.get(endSunday) ?? 0;
  const active4wAgo = activeByWeek.get(addDays(endSunday, -28)) ?? 0;

  // ---------------- recettes hebdo (sections.ts) ----------------
  const METHODS = ["url", "photo", "voice", "manual", "shared", "unknown"];
  const { recipesByWeek, methodMix } = weeklyRecipesSeries(raw.weeklyRecipes, starts12, METHODS);
  const recipesIn = (w: Window) =>
    sum(
      starts12.concat(weekStarts(addDays(endSunday, -28), 4)).filter((s) => inWindow(s, w)),
      (s) => recipesByWeek.get(s) ?? 0,
    );
  const recipes4 = recipesIn(cur4);
  const recipesPrev4 = recipesIn(prev4);
  const perActive = activeNow ? +(recipes4 / activeNow).toFixed(1) : 0;
  const perActivePrev = active4wAgo ? +(recipesPrev4 / active4wAgo).toFixed(1) : 0;

  // ---------------- personnes ----------------
  const np = newPeople(people, cur4);
  const npPrev = newPeople(people, prev4);
  const npWeekly = newPeopleWeekly(people, endSunday, WEEKS);
  const actCur = activationFunnel(people, weeksEnding(addDays(endSunday, -7), 4), today);
  const actPrev = activationFunnel(people, weeksEnding(addDays(endSunday, -35), 4), today);
  const actFunnelSinceJune = activationFunnel(people, { from: "2026-06-01", to: today }, today);
  const byMethod = activationByFirstMethod(people, "2026-06-01", today);
  const actWeekly = activationWeekly(people, endSunday, 8, today);
  const m1 = rollingM1(people, endSunday);
  const m1Prev = rollingM1(people, addDays(endSunday, -7));
  const cohorts = cohortTable(people, today);
  const curves = retentionCurves(cohorts);
  const eng = engagement(people);

  // ---------------- App Store ----------------
  const asIn = (w: Window) => raw.appStore.filter((r) => inWindow(r.day, w));
  const as4 = asIn(cur4);
  const asPrev4 = asIn(prev4);
  const asTotals = (rows: AppStoreDailyRow[]) => ({
    impressions: sum(rows, (r) => num(r.eng_impressions)),
    pageViews: sum(rows, (r) => num(r.eng_page_views)),
    downloads: sum(rows, (r) => num(r.dl_first_time)),
    redownloads: sum(rows, (r) => num(r.dl_redownload)),
    updates: sum(rows, (r) => num(r.dl_update)),
  });
  const appStore = asTotals(as4);
  const appStorePrev = asTotals(asPrev4);
  const sources = new Map<string, number>();
  for (const r of as4) {
    if (!num(r.dl_first_time)) continue;
    const l = sourceLabel(r.source_type, r.source_info);
    sources.set(l, (sources.get(l) ?? 0) + num(r.dl_first_time));
  }
  const appStoreSources = [...sources.entries()]
    .map(([label, downloads]) => ({ label, downloads }))
    .sort((a, b) => b.downloads - a.downloads);
  const appStoreLastDay = raw.appStore.reduce<string | null>(
    (m, r) => (m == null || r.day > m ? r.day : m),
    null,
  );
  const downloadsWeekly = starts12.map((s) =>
    sum(
      raw.appStore.filter((r) => inWindow(r.day, { from: s, to: addDays(s, 6) })),
      (r) => num(r.dl_first_time),
    ),
  );

  // ---------------- démo par plateforme ----------------
  const demoBy = (p: string) =>
    raw.demo.find((d) => d.platform === p) ?? { platform: p, trials: 0, conversions: 0 };
  const demoIos = demoBy("ios");
  const demoWeb = demoBy("web");
  const demoAndroid = demoBy("android");
  const np28 = newPeople(people, { from: addDays(today, -27), to: today });

  // ---------------- santé ----------------
  const h = raw.health;
  const enrichedRate = num(h.recipes_created)
    ? num(h.recipes_enriched) / num(h.recipes_created)
    : 1;
  const pipelineOk =
    num(h.recipes_failed) === 0 && num(h.recipes_pending_stale) === 0 && enrichedRate >= 0.95;
  const rollupH = hoursSince(h.last_rollup, raw.now);
  const syncH = hoursSince(h.last_app_store_sync, raw.now);
  const cronsOk = rollupH != null && rollupH < 36 && syncH != null && syncH < 36;
  const demoOk = num(h.demo_seed_fr) >= raw.demoSeedMin && num(h.demo_seed_en) >= raw.demoSeedMin;
  // Veilleur ops (#27) : sauvegarde nocturne et 5xx au bord. Le veilleur VPS
  // ne remonte rien par lui-même pour les absences : c'est ici que le seuil vit,
  // /api/admin/health l'expose et le veilleur alerte Sentry si `ok` est faux.
  const backupH = hoursSince(raw.backupLastAt, raw.now);
  const backupOk = backupH != null && backupH < BACKUP_MAX_AGE_H;
  const edge24 = sum(
    raw.edgeErrors.filter((r) => r.day.slice(0, 10) >= addDays(today, -1)),
    (r) => num(r.traefik_5xx),
  );
  const edgeOk = edge24 <= EDGE_5XX_MAX_24H;
  const health: Health = {
    ok: pipelineOk && cronsOk && demoOk && backupOk && edgeOk,
    pipeline: {
      ok: pipelineOk,
      detail: `${Math.round(enrichedRate * 100)} % enrichies sur 4 sem. · ${num(h.recipes_failed)} en échec · ${num(h.recipes_pending_stale)} bloquée${num(h.recipes_pending_stale) > 1 ? "s" : ""}`,
    },
    crons: {
      ok: cronsOk,
      detail: `demo-reset ${fmtTs(h.last_rollup)} · app-store-sync ${fmtTs(h.last_app_store_sync)}`,
    },
    demo: {
      ok: demoOk,
      detail: `${num(h.demo_seed_fr)} recettes seed FR · ${num(h.demo_seed_en)} EN (min ${raw.demoSeedMin})`,
    },
    backup: {
      ok: backupOk,
      detail:
        backupH == null
          ? "aucune sauvegarde trouvée sur S3 (ou stockage non configuré)"
          : `dernière ${fmtTs(raw.backupLastAt)} (il y a ${Math.round(backupH)} h, max ${BACKUP_MAX_AGE_H})`,
    },
    edge: {
      ok: edgeOk,
      detail: `${edge24} réponse${edge24 > 1 ? "s" : ""} 5xx vue${edge24 > 1 ? "s" : ""} par Traefik sur hier + aujourd'hui (max ${EDGE_5XX_MAX_24H})`,
    },
  };
  const costPerActive = activeNow ? num(h.ai_cost_usd) / activeNow : 0;

  // ---------------- bloc 0 : 7 derniers jours (données chaudes) ----------------
  const yesterday = addDays(today, -1);
  const dailyByDay = new Map(raw.daily.map((r) => [r.day.slice(0, 10), r]));
  const abByDay = new Map(raw.abOnboarding.map((r) => [r.day.slice(0, 10), r]));
  // « 1ʳᵉ ouverture iOS » : compteur du proxy (046) à partir de son époque,
  // essais démo iOS avant (l'approximation historique — fausse dès le bras B).
  const iosOpens = (d: string) =>
    d >= METRIC_EPOCHS.landingFirstOpen
      ? num(abByDay.get(d)?.first_open_ios)
      : num(dailyByDay.get(d)?.trials_ios);
  const dlByDay = new Map<string, number>();
  for (const r of raw.appStore)
    dlByDay.set(r.day, (dlByDay.get(r.day) ?? 0) + num(r.dl_first_time));
  // Le jour en cours est ajouté en barre partielle (hors valeur et hors repère) :
  // la journée se voit se remplir sans fausser la comparaison au repère.
  const hotOf = (
    id: string,
    label: string,
    get: (day: string) => number,
    opts: { avg?: boolean; unit?: string; hint?: string; lastKnownDay?: string | null } = {},
  ): HotIndicator => hotIndicator(id, label, get, yesterday, { ...opts, today });
  const hot: HotIndicator[] = [
    hotOf("downloads", "Téléchargements App Store", (d) => dlByDay.get(d) ?? 0, {
      // Apple livre ses instances avec 2-3 jours de retard : au-delà, donnée absente.
      lastKnownDay: appStoreLastDay,
      hint: appStoreLastDay
        ? appStoreLastDay < yesterday
          ? `7 jours arrêtés au ${shortDate(appStoreLastDay)} — dernier jour livré par Apple`
          : `Apple jusqu'au ${shortDate(appStoreLastDay)}`
        : "aucune donnée Apple",
    }),
    hotOf("trials", "Essais démo", (d) => num(dailyByDay.get(d)?.trials)),
    hotOf("new", "Nouvelles personnes", (d) => num(dailyByDay.get(d)?.new_people)),
    hotOf("recipes", "Recettes ajoutées", (d) => num(dailyByDay.get(d)?.recipes)),
    hotOf("active", "Personnes actives / jour", (d) => num(dailyByDay.get(d)?.active_people), {
      avg: true,
      hint: "moyenne des 7 jours",
    }),
  ];

  // ---------------- funnel App Store par semaine ----------------
  const storeWeekly: StoreWeek[] = starts12.map((ws) => {
    const days = dayList(7, addDays(ws, 6));
    const rowsW = raw.appStore.filter((r) => r.day >= ws && r.day <= addDays(ws, 6));
    const impressions = sum(rowsW, (r) => num(r.eng_impressions));
    const downloads = sum(rowsW, (r) => num(r.dl_first_time));
    const opens = days.reduce((a, d) => a + iosOpens(d), 0);
    const carnets = newPeople(people, { from: ws, to: addDays(ws, 6) }).ios;
    return {
      weekStart: ws,
      label: ws.slice(8, 10) + "/" + ws.slice(5, 7),
      impressions,
      downloads,
      opens,
      carnets,
      imprToDl: pct1(downloads, impressions),
      dlToOpen: pct1(opens, downloads),
      openToCarnet: pct1(carnets, opens),
      fragile: downloads < 20,
    };
  });

  // ---------------- bloc 1 : tuiles ----------------
  const trend = (cur: number, prev: number): KpiTile["trend"] =>
    cur > prev ? "up" : cur < prev ? "down" : "flat";
  const fmtR = (r: Ratio) => `${pctLabel(r)} (${nLabel(r)})`;
  const tiles: KpiTile[] = [
    {
      id: "new",
      label: "Nouvelles personnes · 4 sem.",
      value: String(np.total),
      compare: `vs ${npPrev.total} les 4 sem. d'avant · ${np.ios} par l'App Store, ${np.web} web${np.invite ? `, ${np.invite} par invitation` : ""}${np.android ? `, ${np.android} Android` : ""}`,
      trend: trend(np.total, npPrev.total),
      spark: npWeekly.map((w) => w.total),
    },
    {
      id: "activation",
      label: "Activées à 7 j · 4 dernières sem. jugeables",
      value: pctLabel(actCur.activated),
      fragile: actCur.activated.fragile,
      title:
        actCur.activated.margin != null
          ? `N = ${actCur.activated.total} : marge ± ${actCur.activated.margin} pts`
          : undefined,
      compare: `${nLabel(actCur.activated)} · vs ${fmtR(actPrev.activated)} avant · ≥ 3 recettes + 1 retour`,
      trend:
        actCur.activated.pct != null && actPrev.activated.pct != null
          ? trend(actCur.activated.pct, actPrev.activated.pct)
          : undefined,
      spark: actWeekly.map((w) => (w.arrivals ? Math.round((w.activated / w.arrivals) * 100) : 0)),
    },
    {
      id: "m1",
      label: `Rétention M1 · cohorte glissante (arrivées du ${shortDate(m1.window.from)} au ${shortDate(m1.window.to)})`,
      value: pctLabel(m1.r),
      fragile: m1.r.fragile,
      title: m1.r.margin != null ? `N = ${m1.r.total} : marge ± ${m1.r.margin} pts` : undefined,
      compare: `${nLabel(m1.r)} · vs ${fmtR(m1Prev.r)} la semaine d'avant`,
      trend: deltaPts(m1.r, m1Prev.r) == null ? undefined : trend(m1.r.pct ?? 0, m1Prev.r.pct ?? 0),
      bench: "repère marché D30 ≈ 6 % (iOS, toutes catégories)",
    },
    {
      id: "recipes",
      label: "Recettes / cuisinier actif · 4 sem.",
      value: String(perActive).replace(".", ","),
      compare: `${recipes4} recettes · vs ${String(perActivePrev).replace(".", ",")} avant`,
      trend: trend(perActive, perActivePrev),
      spark: starts12.map((s) => recipesByWeek.get(s) ?? 0),
    },
    {
      id: "cost",
      label: "Coût IA / cuisinier actif · 28 j",
      value: costPerActive.toFixed(2).replace(".", ","),
      unit: "$",
      compare: `${usd(num(h.ai_cost_usd))} hors démo${raw.billedUsd != null ? ` · facturé ${usd(raw.billedUsd)}` : ""}`,
    },
  ];

  // ---------------- « ce qui a bougé » ----------------
  const moved: string[] = [];
  const lastWeek = npWeekly[npWeekly.length - 1];
  if (
    lastWeek &&
    lastWeek.total > 0 &&
    lastWeek.total >= Math.max(...npWeekly.slice(0, -1).map((w) => w.total))
  ) {
    const chan = (["ios", "web", "invite", "android"] as Channel[])
      .filter((c) => lastWeek[c] > 0)
      .map((c) => `${lastWeek[c]} ${CHANNEL_LABELS[c]}`)
      .join(", ");
    moved.push(
      `${lastWeek.total} nouvelle${lastWeek.total > 1 ? "s" : ""} personne${lastWeek.total > 1 ? "s" : ""} la semaine dernière (${chan}) — record sur 12 semaines.`,
    );
  }
  const m1d = deltaPts(m1.r, m1Prev.r);
  if (m1d != null && m1d !== 0) {
    moved.push(
      `Rétention M1 glissante : ${pctLabel(m1.r)} (${nLabel(m1.r)}), ${m1d > 0 ? "+" : ""}${m1d} pts vs la semaine d'avant.`,
    );
  }
  const ad = deltaPts(actCur.activated, actPrev.activated);
  if (ad != null && Math.abs(ad) >= 5) {
    moved.push(
      `Activation à 7 j : ${pctLabel(actCur.activated)} (${nLabel(actCur.activated)}), ${ad > 0 ? "+" : ""}${ad} pts vs les 4 semaines d'avant.`,
    );
  }
  if (
    appStore.downloads &&
    appStorePrev.downloads &&
    Math.abs(appStore.downloads - appStorePrev.downloads) / appStorePrev.downloads >= 0.3
  ) {
    moved.push(
      `Téléchargements App Store : ${appStore.downloads} sur 4 sem., contre ${appStorePrev.downloads} avant.`,
    );
  }
  const best = byMethod
    .filter((m) => m.method !== "none" && m.r.total >= 5)
    .sort((a, b) => (b.r.pct ?? 0) - (a.r.pct ?? 0));
  if (best.length >= 2 && moved.length < 3) {
    moved.push(
      `Première recette par ${best[0].label} : ${nLabel(best[0].r)} activées ; par ${best[best.length - 1].label} : ${nLabel(best[best.length - 1].r)}.`,
    );
  }
  if (activeNow !== active4wAgo && moved.length < 3) {
    moved.push(
      `Cuisiniers actifs 28 j : ${activeNow}, ${activeNow > active4wAgo ? "+" : ""}${activeNow - active4wAgo} vs 4 semaines plus tôt.`,
    );
  }

  const overview = {
    dataDate: today,
    hot,
    /** Fenêtre de référence du bloc 0 (7 jours clos) ; `hotToday` = la barre en cours. */
    hotWindow: { from: addDays(yesterday, -6), to: yesterday },
    hotToday: today,
    weekLabel: `semaine du ${shortDate(starts12[WEEKS - 1])}`,
    northStar: {
      value: activeNow,
      engaged: engagedByWeek.get(endSunday) ?? 0,
      total: people.length,
      delta: activeNow - active4wAgo,
      fourWeeksAgo: active4wAgo,
      series: activeSeries,
      seriesLabels: starts12.map((s) => s.slice(8, 10) + "/" + s.slice(5, 7)),
    },
    tiles,
    health,
    moved: moved.slice(0, 3),
  };

  // ---------------- blocs 2-6 ----------------
  const acquisition = {
    appStore: {
      ...appStore,
      firstOpenIos: dayList(28, today).reduce((a, d) => a + iosOpens(d), 0),
      firstCarnetIos: np28.ios,
      lastDay: appStoreLastDay,
      sources: appStoreSources,
      weekly: downloadsWeekly,
      funnelWeekly: storeWeekly,
      pageToInstall: ratio(appStore.downloads, appStore.pageViews),
      impressionToInstall: appStore.impressions
        ? +((appStore.downloads / appStore.impressions) * 100).toFixed(1)
        : null,
    },
    web: {
      trials: num(demoWeb.trials),
      conversions: num(demoWeb.conversions),
      firstCarnetWeb: np28.web,
    },
    android: { trials: num(demoAndroid.trials), conversions: num(demoAndroid.conversions) },
    demo: {
      ios: ratio(num(demoIos.conversions), num(demoIos.trials)),
      web: ratio(num(demoWeb.conversions), num(demoWeb.trials)),
      android: ratio(num(demoAndroid.conversions), num(demoAndroid.trials)),
    },
    invites: np28.invite,
    weekly: npWeekly,
    listingMarker:
      PRODUCT_EVENTS.appStoreListingV2 >= starts12[0]
        ? npWeekly.findIndex(
            (w) =>
              w.weekStart <= PRODUCT_EVENTS.appStoreListingV2 &&
              addDays(w.weekStart, 6) >= PRODUCT_EVENTS.appStoreListingV2,
          )
        : -1,
  };

  // A/B onboarding (#25) : chaîne par bras depuis le début du test. Dénominateur
  // = affectations du shell iOS natif (migration 050) ; le total toutes surfaces
  // reste affiché en information.
  const abSince = PRODUCT_EVENTS.abOnboardingStart;
  const abDays = raw.abOnboarding.filter((r) => r.day.slice(0, 10) >= abSince);
  const abAssigned = abDays.reduce(
    (acc, r) => ({ a: acc.a + num(r.assigned_a_ios), b: acc.b + num(r.assigned_b_ios) }),
    { a: 0, b: 0 },
  );
  const abAssignedAll = abDays.reduce(
    (acc, r) => ({ a: acc.a + num(r.assigned_a), b: acc.b + num(r.assigned_b) }),
    { a: 0, b: 0 },
  );
  const ab = {
    since: abSince,
    arms: abOnboardingFunnel(people, abAssigned, abAssignedAll, abSince, today),
    before: abBeforeWindow(people, abSince),
  };
  const activation = {
    funnel: actFunnelSinceJune,
    byMethod,
    weekly: actWeekly,
    current: actCur,
    ab,
  };

  const retention = {
    rolling: m1,
    rollingPrev: m1Prev,
    cohorts,
    curves,
    cake,
    cakeKeys,
    cakeLabels: cakeKeys.map((k, i) => (i === 0 && olderKey ? `≤ ${monthName(k)}` : monthName(k))),
    leaving: eng.leaving.length,
    leavingWithEmailAndRecipes: eng.leaving.filter((p) => p.has_email && p.recipes_total >= 5)
      .length,
    activeWithoutEmail: eng.activeWithoutEmail,
  };

  const sharedCarnets = raw.carnets.filter((c) => c.members > 1 || c.guests > 0).length;
  const engage = {
    ...eng,
    methodMix,
    methodKeys: METHODS,
    methodLabels: METHODS.map((k) => METHOD_LABELS[k] ?? k),
    sharing: {
      links: num(raw.sharing.links),
      estimate: raw.sharing.links_dated_estimate,
      copies: num(raw.sharing.copies),
      arrivals: newPeople(people, { from: addDays(today, -83), to: today }).invite,
    },
    carnets: raw.carnets.length,
    sharedCarnets,
    carnetsWithGuests: raw.carnets.filter((c) => c.guests > 0).length,
  };

  const ops = {
    cost: {
      total: num(h.ai_cost_usd),
      demo: num(h.ai_cost_demo_usd),
      billed: raw.billedUsd,
      perRecipe: num(h.recipes_created) ? num(h.ai_cost_usd) / num(h.recipes_created) : 0,
      aiCalls: num(h.ai_calls),
    },
    pipeline: {
      created: num(h.recipes_created),
      enriched: num(h.recipes_enriched),
      failed: num(h.recipes_failed),
      stale: num(h.recipes_pending_stale),
      rate: Math.round(enrichedRate * 100),
    },
    crons: {
      rollup: h.last_rollup,
      sync: h.last_app_store_sync,
      rollupLabel: fmtTs(h.last_rollup),
      syncLabel: fmtTs(h.last_app_store_sync),
    },
    demo: {
      seedFr: num(h.demo_seed_fr),
      seedEn: num(h.demo_seed_en),
      trials: num(h.demo_trials),
      frozen: num(h.demo_frozen_hits),
      aiCalls: num(h.demo_ai_calls),
      recipes: num(h.demo_recipes),
    },
    account: {
      withEmail: eng.withEmail,
      total: people.length,
      newWithEmail: people.filter((p) => inWindow(p.created_at.slice(0, 10), cur4) && p.has_email)
        .length,
      newTotal: np.total,
      recoverySent: num(h.recovery_sent),
      recoveryUsed: num(h.recovery_used),
      merges: num(h.merge_used),
      burned: num(h.tokens_burned),
    },
  };

  return {
    overview,
    acquisition,
    activation,
    retention,
    engage,
    ops,
    windows: { cur4, prev4, endSunday, today },
  };
}

export type DashboardV3 = ReturnType<typeof assembleV3>;
export type Overview = DashboardV3["overview"];

export function monthName(isoMonth: string): string {
  const s = new Date(isoMonth.slice(0, 7) + "-01T00:00:00Z").toLocaleDateString("fr-FR", {
    month: "long",
    timeZone: "UTC",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
