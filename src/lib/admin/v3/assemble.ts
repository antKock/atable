// Assemblage pur du dashboard v3 à partir des lignes brutes (RPC 043 +
// app_store_daily). Aucune I/O : testable, et partagé par la page et le digest
// hebdo (bloc 1). Les lectures Supabase sont dans data.ts.

import { sourceLabel } from "@/lib/admin/app-store";
import type { AppStoreDailyRow } from "@/lib/admin/app-store";
import {
  type Person,
  type Channel,
  CHANNEL_LABELS,
  METHOD_LABELS,
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
import { type Window, addDays, inWindow, iso, lastSunday, shortDate, weekStarts, weeksEnding } from "@/lib/admin/v3/weeks";
import { PRODUCT_EVENTS } from "@/lib/admin/epochs";

export type WeeklyActiveRow = { week_end: string; cohort_month: string; active: number; engaged: number };
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
  billedUsd: number | null;
  demoSeedMin: number;
  now: Date;
};

const WEEKS = 12;
const num = (v: unknown) => Number(v) || 0;
const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

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

export type Health = {
  ok: boolean;
  pipeline: { ok: boolean; detail: string };
  crons: { ok: boolean; detail: string };
  demo: { ok: boolean; detail: string };
};

function hoursSince(isoTs: string | null, now: Date): number | null {
  if (!isoTs) return null;
  return (now.getTime() - new Date(isoTs).getTime()) / 3_600_000;
}

function fmtTs(isoTs: string | null): string {
  if (!isoTs) return "jamais";
  return new Date(isoTs).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

const usd = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;

export function assembleV3(raw: RawV3) {
  const today = iso(raw.now);
  const endSunday = lastSunday(raw.now);
  const cur4: Window = weeksEnding(endSunday, 4);
  const prev4: Window = weeksEnding(addDays(endSunday, -28), 4);
  const starts12 = weekStarts(endSunday, WEEKS);
  const people = raw.people;

  // ---------------- séries hebdo actifs ----------------
  const activeByWeek = new Map<string, number>();
  const engagedByWeek = new Map<string, number>();
  const cohortMonths = new Set<string>();
  for (const r of raw.weeklyActive) {
    activeByWeek.set(r.week_end, (activeByWeek.get(r.week_end) ?? 0) + num(r.active));
    engagedByWeek.set(r.week_end, (engagedByWeek.get(r.week_end) ?? 0) + num(r.engaged));
    cohortMonths.add(r.cohort_month.slice(0, 7));
  }
  const weekEnds = starts12.map((s) => addDays(s, 6));
  const activeSeries = weekEnds.map((we) => activeByWeek.get(we) ?? 0);
  const activeNow = activeByWeek.get(endSunday) ?? 0;
  const active4wAgo = activeByWeek.get(addDays(endSunday, -28)) ?? 0;

  // Layer cake : semaine × mois d'arrivée (mois ≤ 4e plus ancien regroupés).
  const months = [...cohortMonths].sort();
  const cakeMonths = months.length > 5 ? [...months.slice(-4)] : months;
  const olderKey = months.length > 5 ? months[months.length - 5] : null;
  const cakeKeys = olderKey ? [olderKey, ...cakeMonths] : cakeMonths;
  const cake = weekEnds.map((we, i) => {
    const row: Record<string, number | string> = { label: starts12[i].slice(8, 10) + "/" + starts12[i].slice(5, 7), weekEnd: we };
    for (const k of cakeKeys) row[k] = 0;
    for (const r of raw.weeklyActive) {
      if (r.week_end !== we) continue;
      const m = r.cohort_month.slice(0, 7);
      const key = olderKey && m <= olderKey ? olderKey : m;
      row[key] = num(row[key]) + num(r.active);
    }
    return row;
  });

  // ---------------- recettes hebdo ----------------
  const recipesByWeek = new Map<string, number>();
  const mixByWeek = new Map<string, Record<string, number>>();
  for (const r of raw.weeklyRecipes) {
    const ws = r.week_start.slice(0, 10);
    recipesByWeek.set(ws, (recipesByWeek.get(ws) ?? 0) + num(r.recipes));
    const m = mixByWeek.get(ws) ?? {};
    m[r.source] = (m[r.source] ?? 0) + num(r.recipes);
    mixByWeek.set(ws, m);
  }
  const recipesIn = (w: Window) => sum(starts12.concat(weekStarts(addDays(endSunday, -28), 4)).filter((s) => inWindow(s, w)), (s) => recipesByWeek.get(s) ?? 0);
  const recipes4 = recipesIn(cur4);
  const recipesPrev4 = recipesIn(prev4);
  const perActive = activeNow ? +(recipes4 / activeNow).toFixed(1) : 0;
  const perActivePrev = active4wAgo ? +(recipesPrev4 / active4wAgo).toFixed(1) : 0;
  const METHODS = ["url", "photo", "voice", "manual", "shared", "unknown"];
  const methodMix = starts12.map((s) => {
    const m = mixByWeek.get(s) ?? {};
    const tot = METHODS.reduce((a, k) => a + (m[k] ?? 0), 0);
    const row: Record<string, number | string> = { label: s.slice(8, 10) + "/" + s.slice(5, 7), total: tot };
    // Parts arrondies qui somment à 100 : la dernière méthode non nulle absorbe l'écart.
    let acc = 0;
    let lastKey: string | null = null;
    for (const k of METHODS) {
      const v = tot ? Math.round(((m[k] ?? 0) / tot) * 100) : 0;
      row[k] = v;
      acc += v;
      if (v > 0) lastKey = k;
    }
    if (lastKey && acc !== 100) row[lastKey] = num(row[lastKey]) + (100 - acc);
    return row;
  });

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
  const appStoreSources = [...sources.entries()].map(([label, downloads]) => ({ label, downloads })).sort((a, b) => b.downloads - a.downloads);
  const appStoreLastDay = raw.appStore.reduce<string | null>((m, r) => (m == null || r.day > m ? r.day : m), null);
  const downloadsWeekly = starts12.map((s) => sum(raw.appStore.filter((r) => inWindow(r.day, { from: s, to: addDays(s, 6) })), (r) => num(r.dl_first_time)));

  // ---------------- démo par plateforme ----------------
  const demoBy = (p: string) => raw.demo.find((d) => d.platform === p) ?? { platform: p, trials: 0, conversions: 0 };
  const demoIos = demoBy("ios");
  const demoWeb = demoBy("web");
  const demoAndroid = demoBy("android");
  const np28 = newPeople(people, { from: addDays(today, -27), to: today });

  // ---------------- santé ----------------
  const h = raw.health;
  const enrichedRate = num(h.recipes_created) ? num(h.recipes_enriched) / num(h.recipes_created) : 1;
  const pipelineOk = num(h.recipes_failed) === 0 && num(h.recipes_pending_stale) === 0 && enrichedRate >= 0.95;
  const rollupH = hoursSince(h.last_rollup, raw.now);
  const syncH = hoursSince(h.last_app_store_sync, raw.now);
  const cronsOk = rollupH != null && rollupH < 36 && syncH != null && syncH < 36;
  const demoOk = num(h.demo_seed_fr) >= raw.demoSeedMin && num(h.demo_seed_en) >= raw.demoSeedMin;
  const health: Health = {
    ok: pipelineOk && cronsOk && demoOk,
    pipeline: {
      ok: pipelineOk,
      detail: `${Math.round(enrichedRate * 100)} % enrichies sur 4 sem. · ${num(h.recipes_failed)} en échec · ${num(h.recipes_pending_stale)} bloquée${num(h.recipes_pending_stale) > 1 ? "s" : ""}`,
    },
    crons: { ok: cronsOk, detail: `demo-reset ${fmtTs(h.last_rollup)} · app-store-sync ${fmtTs(h.last_app_store_sync)}` },
    demo: { ok: demoOk, detail: `${num(h.demo_seed_fr)} recettes seed FR · ${num(h.demo_seed_en)} EN (min ${raw.demoSeedMin})` },
  };
  const costPerActive = activeNow ? num(h.ai_cost_usd) / activeNow : 0;

  // ---------------- bloc 1 : tuiles ----------------
  const trend = (cur: number, prev: number): KpiTile["trend"] => (cur > prev ? "up" : cur < prev ? "down" : "flat");
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
      title: actCur.activated.margin != null ? `N = ${actCur.activated.total} : marge ± ${actCur.activated.margin} pts` : undefined,
      compare: `${nLabel(actCur.activated)} · vs ${fmtR(actPrev.activated)} avant · ≥ 3 recettes + 1 retour`,
      trend: actCur.activated.pct != null && actPrev.activated.pct != null ? trend(actCur.activated.pct, actPrev.activated.pct) : undefined,
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
  if (lastWeek && lastWeek.total > 0 && lastWeek.total >= Math.max(...npWeekly.slice(0, -1).map((w) => w.total))) {
    const chan = (["ios", "web", "invite", "android"] as Channel[]).filter((c) => lastWeek[c] > 0).map((c) => `${lastWeek[c]} ${CHANNEL_LABELS[c]}`).join(", ");
    moved.push(`${lastWeek.total} nouvelle${lastWeek.total > 1 ? "s" : ""} personne${lastWeek.total > 1 ? "s" : ""} la semaine dernière (${chan}) — record sur 12 semaines.`);
  }
  const m1d = deltaPts(m1.r, m1Prev.r);
  if (m1d != null && m1d !== 0) {
    moved.push(`Rétention M1 glissante : ${pctLabel(m1.r)} (${nLabel(m1.r)}), ${m1d > 0 ? "+" : ""}${m1d} pts vs la semaine d'avant.`);
  }
  const ad = deltaPts(actCur.activated, actPrev.activated);
  if (ad != null && Math.abs(ad) >= 5) {
    moved.push(`Activation à 7 j : ${pctLabel(actCur.activated)} (${nLabel(actCur.activated)}), ${ad > 0 ? "+" : ""}${ad} pts vs les 4 semaines d'avant.`);
  }
  if (appStore.downloads && appStorePrev.downloads && Math.abs(appStore.downloads - appStorePrev.downloads) / appStorePrev.downloads >= 0.3) {
    moved.push(`Téléchargements App Store : ${appStore.downloads} sur 4 sem., contre ${appStorePrev.downloads} avant.`);
  }
  const best = byMethod.filter((m) => m.method !== "none" && m.r.total >= 5).sort((a, b) => (b.r.pct ?? 0) - (a.r.pct ?? 0));
  if (best.length >= 2 && moved.length < 3) {
    moved.push(`Première recette par ${best[0].label} : ${nLabel(best[0].r)} activées ; par ${best[best.length - 1].label} : ${nLabel(best[best.length - 1].r)}.`);
  }
  if (activeNow !== active4wAgo && moved.length < 3) {
    moved.push(`Cuisiniers actifs 28 j : ${activeNow}, ${activeNow > active4wAgo ? "+" : ""}${activeNow - active4wAgo} vs 4 semaines plus tôt.`);
  }

  const overview = {
    dataDate: today,
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
      firstOpenIos: num(demoIos.trials),
      firstCarnetIos: np28.ios,
      lastDay: appStoreLastDay,
      sources: appStoreSources,
      weekly: downloadsWeekly,
      pageToInstall: ratio(appStore.downloads, appStore.pageViews),
      impressionToInstall: appStore.impressions ? +((appStore.downloads / appStore.impressions) * 100).toFixed(1) : null,
    },
    web: { trials: num(demoWeb.trials), conversions: num(demoWeb.conversions), firstCarnetWeb: np28.web },
    android: { trials: num(demoAndroid.trials), conversions: num(demoAndroid.conversions) },
    demo: { ios: ratio(num(demoIos.conversions), num(demoIos.trials)), web: ratio(num(demoWeb.conversions), num(demoWeb.trials)), android: ratio(num(demoAndroid.conversions), num(demoAndroid.trials)) },
    invites: np28.invite,
    weekly: npWeekly,
    listingMarker: PRODUCT_EVENTS.appStoreListingV2 >= starts12[0] ? npWeekly.findIndex((w) => w.weekStart <= PRODUCT_EVENTS.appStoreListingV2 && addDays(w.weekStart, 6) >= PRODUCT_EVENTS.appStoreListingV2) : -1,
  };

  const activation = { funnel: actFunnelSinceJune, byMethod, weekly: actWeekly, current: actCur };

  const retention = {
    rolling: m1,
    rollingPrev: m1Prev,
    cohorts,
    curves,
    cake,
    cakeKeys,
    cakeLabels: cakeKeys.map((k, i) => (i === 0 && olderKey ? `≤ ${monthName(k)}` : monthName(k))),
    leaving: eng.leaving.length,
    leavingWithEmailAndRecipes: eng.leaving.filter((p) => p.has_email && p.recipes_total >= 5).length,
    activeWithoutEmail: eng.activeWithoutEmail,
  };

  const sharedCarnets = raw.carnets.filter((c) => c.members > 1 || c.guests > 0).length;
  const engage = {
    ...eng,
    methodMix,
    methodKeys: METHODS,
    methodLabels: METHODS.map((k) => METHOD_LABELS[k] ?? k),
    sharing: { links: num(raw.sharing.links), estimate: raw.sharing.links_dated_estimate, copies: num(raw.sharing.copies), arrivals: newPeople(people, { from: addDays(today, -83), to: today }).invite },
    carnets: raw.carnets.length,
    sharedCarnets,
    carnetsWithGuests: raw.carnets.filter((c) => c.guests > 0).length,
  };

  const ops = {
    cost: { total: num(h.ai_cost_usd), demo: num(h.ai_cost_demo_usd), billed: raw.billedUsd, perRecipe: num(h.recipes_created) ? num(h.ai_cost_usd) / num(h.recipes_created) : 0, aiCalls: num(h.ai_calls) },
    pipeline: { created: num(h.recipes_created), enriched: num(h.recipes_enriched), failed: num(h.recipes_failed), stale: num(h.recipes_pending_stale), rate: Math.round(enrichedRate * 100) },
    crons: { rollup: h.last_rollup, sync: h.last_app_store_sync, rollupLabel: fmtTs(h.last_rollup), syncLabel: fmtTs(h.last_app_store_sync) },
    demo: { seedFr: num(h.demo_seed_fr), seedEn: num(h.demo_seed_en), trials: num(h.demo_trials), frozen: num(h.demo_frozen_hits), aiCalls: num(h.demo_ai_calls), recipes: num(h.demo_recipes) },
    account: { withEmail: eng.withEmail, total: people.length, newWithEmail: people.filter((p) => inWindow(p.created_at.slice(0, 10), cur4) && p.has_email).length, newTotal: np.total, recoverySent: num(h.recovery_sent), recoveryUsed: num(h.recovery_used), merges: num(h.merge_used), burned: num(h.tokens_burned) },
  };

  return { overview, acquisition, activation, retention, engage, ops, windows: { cur4, prev4, endSunday, today } };
}

export type DashboardV3 = ReturnType<typeof assembleV3>;
export type Overview = DashboardV3["overview"];

export function monthName(isoMonth: string): string {
  const s = new Date(isoMonth.slice(0, 7) + "-01T00:00:00Z").toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
