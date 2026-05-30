import { createServerClient } from "@/lib/supabase/server";
import {
  METHOD_LABELS,
  METHOD_COLORS,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
} from "@/lib/admin/palette";

// ---------------------------------------------------------------------------
// Server-side data layer for the usage dashboard. Calls the analytics_* RPC
// functions in parallel and shapes the rows into the structures the chart
// components expect. Demo/seed exclusion happens inside the SQL functions.
//
// Filters: period (from/to), platform, household IDs. The all-time KPI totals
// are intentionally NOT period-filtered (parc).
// ---------------------------------------------------------------------------

export type DashboardFilters = {
  from?: string; // ISO date (YYYY-MM-DD)
  to?: string;
  platform?: "ios" | "android" | "web" | null;
  householdIds?: string[] | null;
};

export type KpiCard = {
  id: string;
  label: string;
  sub: string;
  value: string;
  total?: string;
  delta?: number;
  positive?: boolean;
  suffix?: string;
  spark?: { v: number }[];
};

export type Signal = { value: string; label: string; hint: string; warn?: boolean };

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const fr = (n: number) => Math.round(n).toLocaleString("fr-FR");
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

function weekKey(isoDay: string): string {
  // Monday-anchored ISO week start for a YYYY-MM-DD string.
  const d = new Date(isoDay + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return ISO(d);
}

function shortLabel(isoDay: string): string {
  const d = new Date(isoDay + "T00:00:00Z");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
}

function monthLabel(isoDay: string): string {
  const d = new Date(isoDay + "T00:00:00Z");
  return d.toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" });
}

const spark = (vals: number[]) => vals.slice(-14).map((v) => ({ v }));

type Row = Record<string, unknown>;

export async function getDashboardData(filters: DashboardFilters = {}) {
  const supabase = createServerClient();
  const hh = filters.householdIds && filters.householdIds.length ? filters.householdIds : null;
  const plat = filters.platform ?? null;

  const today = new Date();
  const from60 = new Date(today);
  from60.setUTCDate(from60.getUTCDate() - 60);
  const from182 = new Date(today);
  from182.setUTCDate(from182.getUTCDate() - 182);

  const rpc = <T = Row[]>(fn: string, params: Record<string, unknown> = {}) =>
    supabase.rpc(fn, params).then(({ data, error }) => {
      if (error) throw new Error(`${fn}: ${error.message}`);
      return (data ?? []) as T;
    });

  const [
    kpisRow,
    recipesDaily,
    enrichment,
    activation,
    activeWeekly,
    cumulative,
    acquisition,
    householdSize,
    recipesPerHH,
    sourceMix,
    sourceMixMonthly,
    topHouseholds,
    retentionRows,
    loginFreq,
    depth,
    platformsRows,
  ] = await Promise.all([
    rpc("analytics_kpis", { p_household_ids: hh }),
    rpc("analytics_recipes_created_daily", { p_from: ISO(from182), p_household_ids: hh, p_platform: plat }),
    rpc("analytics_enrichment", { p_household_ids: hh }),
    rpc("analytics_activation", {}),
    rpc("analytics_active_weekly", { p_weeks: 26, p_platform: plat, p_household_ids: hh }),
    rpc("analytics_cumulative_parc", { p_weeks: 26 }),
    rpc("analytics_acquisition_weekly", { p_weeks: 26 }),
    rpc("analytics_household_size_dist", {}),
    rpc("analytics_recipes_per_household_dist", { p_household_ids: hh }),
    rpc("analytics_source_mix", { p_household_ids: hh, p_platform: plat }),
    rpc("analytics_source_mix_monthly", { p_months: 9, p_household_ids: hh }),
    rpc("analytics_top_households", { p_limit: 8 }),
    rpc("analytics_retention_cohorts", { p_cohorts: 3, p_max_week: 8 }),
    rpc("analytics_login_frequency", { p_platform: plat, p_household_ids: hh }),
    rpc<number>("analytics_depth", { p_household_ids: hh }),
    rpc("analytics_recipes_by_platform", { p_household_ids: hh }),
  ]);

  const k = (kpisRow[0] ?? {}) as Record<string, number>;

  // ---- time series ----
  const wauMau = (activeWeekly as Row[]).map((r) => ({
    label: shortLabel(r.week as string),
    wau: Number(r.wau),
    mau: Number(r.mau),
    stickiness: r.stickiness == null ? 0 : Number(r.stickiness),
  }));

  const parc = (cumulative as Row[]).map((r) => ({
    label: shortLabel(r.week as string),
    foyers: Number(r.foyers),
    appareils: Number(r.appareils),
    recettes: Number(r.recettes),
  }));

  const acquisitionSeries = (acquisition as Row[]).map((r) => ({
    label: shortLabel(r.week as string),
    devices: Number(r.devices),
    foyers: Number(r.foyers),
  }));

  // weekly recipe creation (bucket daily → week)
  const weekMap = new Map<string, number>();
  for (const r of recipesDaily as Row[]) {
    const wk = weekKey(r.day as string);
    weekMap.set(wk, (weekMap.get(wk) ?? 0) + Number(r.recipes));
  }
  const recipeCreation = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([wk, total]) => ({ label: shortLabel(wk), total }));

  // ---- distributions ----
  const sizeBins = { "1": 0, "2": 0, "3": 0, "4": 0, "5+": 0 };
  for (const r of householdSize as Row[]) {
    const s = Number(r.size);
    const key = s >= 5 ? "5+" : String(s);
    if (key in sizeBins) sizeBins[key as keyof typeof sizeBins] += Number(r.households);
  }
  const householdSizeDist = Object.entries(sizeBins).map(([bin, foyers]) => ({ bin, foyers }));

  const recipesPerHousehold = (recipesPerHH as Row[]).map((r) => ({
    bin: r.bucket as string,
    foyers: Number(r.households),
  }));

  const loginFrequency = (loginFreq as Row[]).map((r) => ({
    bin: r.bin as string,
    devices: Number(r.devices),
  }));

  // ---- method mix (donut) ----
  const methodTotal = (sourceMix as Row[]).reduce((s, r) => s + Number(r.recipes), 0);
  const addMethods = (sourceMix as Row[]).map((r) => {
    const key = r.source as keyof typeof METHOD_LABELS;
    return {
      name: METHOD_LABELS[key] ?? (r.source as string),
      key: r.source as string,
      value: Math.round(pct(Number(r.recipes), methodTotal)),
      color: METHOD_COLORS[key] ?? METHOD_COLORS.unknown,
    };
  });

  // ---- method mix over time (stacked %) ----
  const monthMap = new Map<string, Record<string, number>>();
  for (const r of sourceMixMonthly as Row[]) {
    const m = r.month as string;
    if (!monthMap.has(m)) monthMap.set(m, {});
    monthMap.get(m)![r.source as string] = Number(r.recipes);
  }
  const addMethodsOverTime = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, srcs]) => {
      const tot = Object.values(srcs).reduce((s, v) => s + v, 0);
      const share = (key: string) => +pct(srcs[key] ?? 0, tot).toFixed(1);
      return {
        label: monthLabel(m),
        manual: share("manual"),
        url: share("url"),
        photo: share("photo"),
        voice: share("voice"),
        unknown: share("unknown"),
      };
    });

  // ---- platform donut ----
  const platTotal = (platformsRows as Row[]).reduce((s, r) => s + Number(r.recipes), 0);
  const platforms = (platformsRows as Row[]).map((r) => {
    const key = r.platform as keyof typeof PLATFORM_LABELS;
    return {
      name: PLATFORM_LABELS[key] ?? (r.platform as string),
      key: r.platform as string,
      value: Math.round(pct(Number(r.recipes), platTotal)),
      color: PLATFORM_COLORS[key] ?? PLATFORM_COLORS.unknown,
    };
  });

  // ---- top households ----
  const topHouseholdsList = (topHouseholds as Row[]).map((r) => ({
    name: r.name as string,
    recettes: Number(r.recipes),
    actif: r.last_active as string | null,
  }));

  // ---- retention (pivot cohorts → weeks) ----
  const cohortLabels = [...new Set((retentionRows as Row[]).map((r) => r.cohort as string))].sort();
  const cohortName = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" });
  const maxWeek = Math.max(0, ...(retentionRows as Row[]).map((r) => Number(r.week_offset)));
  const retention = Array.from({ length: maxWeek + 1 }, (_, w) => {
    const point: Record<string, number | string> = { label: `S${w}` };
    for (const c of cohortLabels) {
      const row = (retentionRows as Row[]).find(
        (r) => r.cohort === c && Number(r.week_offset) === w,
      );
      point[cohortName(c)] = row ? Number(row.pct) : 0;
    }
    return point;
  });
  const retentionCohorts = cohortLabels.map((c) => cohortName(c));

  // ---- enrichment / coverage ----
  const enrichRows = enrichment as Row[];
  const enr = (kind: string, status: string) =>
    enrichRows
      .filter((r) => r.kind === kind && r.status === status)
      .reduce((s, r) => s + Number(r.recipes), 0);
  const enrTotal = enrichRows.filter((r) => r.kind === "enrichment").reduce((s, r) => s + Number(r.recipes), 0);
  const enrSuccess = enr("enrichment", "enriched");
  const enrFailed = enr("enrichment", "failed");
  const coveragePct = Math.round(pct(enrSuccess, enrTotal));
  const aiPipeline = [
    { name: "Succès", value: +pct(enrSuccess, enrSuccess + enrFailed).toFixed(1), color: METHOD_COLORS.manual },
    { name: "Échec", value: +pct(enrFailed, enrSuccess + enrFailed).toFixed(1), color: PLATFORM_COLORS.web },
  ];

  // ---- activation (overall, recent cohorts) ----
  const actRows = activation as Row[];
  const actHouseholds = actRows.reduce((s, r) => s + Number(r.households), 0);
  const actActivated = actRows.reduce((s, r) => s + Number(r.activated), 0);
  const activationPct = Math.round(pct(actActivated, actHouseholds));

  // ---- réactivation J1 (devices active on >1 day) from login frequency ----
  const totalDevices = loginFrequency.reduce((s, b) => s + b.devices, 0);
  const returningDevices = loginFrequency
    .filter((b) => b.bin !== "1 j")
    .reduce((s, b) => s + b.devices, 0);
  const reactivationPct = Math.round(pct(returningDevices, totalDevices));

  // ---- recipes created: current vs previous 30d (value + delta) ----
  const cutoff30 = new Date(today);
  cutoff30.setUTCDate(cutoff30.getUTCDate() - 30);
  let recipesCur = 0;
  let recipesPrev = 0;
  for (const r of recipesDaily as Row[]) {
    const day = new Date((r.day as string) + "T00:00:00Z");
    if (day >= cutoff30) recipesCur += Number(r.recipes);
    else if (day >= from60) recipesPrev += Number(r.recipes);
  }
  // Only surface a delta once the prior window has enough signal — otherwise
  // tiny volumes produce absurd percentages (e.g. 1 → 14 recipes = +1300 %).
  const recipesDelta = recipesPrev >= 5 ? +(((recipesCur - recipesPrev) / recipesPrev) * 100).toFixed(1) : undefined;

  const lastActive = wauMau[wauMau.length - 1] ?? { mau: 0, wau: 0, stickiness: 0 };

  // ---- KPIs ----
  const kpis: KpiCard[] = [
    {
      id: "foyers",
      label: "Foyers actifs",
      sub: "30 j",
      value: fr(k.active_households_30d ?? 0),
      total: fr(k.households_total ?? 0),
      spark: spark(parc.map((p) => p.foyers)),
    },
    {
      id: "devices",
      label: "Appareils actifs",
      sub: "MAU",
      value: fr(lastActive.mau),
      total: fr(k.devices_total ?? 0),
      spark: spark(parc.map((p) => p.appareils)),
    },
    {
      id: "sticky",
      label: "Stickiness",
      sub: "WAU / MAU",
      value: `${String(lastActive.stickiness).replace(".", ",")} %`,
      suffix: "pts",
      spark: spark(wauMau.map((w) => w.stickiness)),
    },
    {
      id: "reactiv",
      label: "Réactivation J1",
      sub: "appareils revenus après J1",
      value: `${reactivationPct} %`,
      suffix: "pts",
    },
    {
      id: "activation",
      label: "Activation 7 j",
      sub: "≥ 1 recette",
      value: `${activationPct} %`,
      suffix: "pts",
    },
    {
      id: "recipes",
      label: "Recettes créées",
      sub: "30 j",
      value: fr(recipesCur),
      total: fr(k.recipes_total ?? 0),
      delta: recipesDelta,
      positive: recipesDelta == null ? undefined : recipesDelta >= 0,
      spark: spark(recipeCreation.map((r) => r.total)),
    },
    {
      id: "coverage",
      label: "Couverture IA",
      sub: "recettes enrichies",
      value: `${coveragePct} %`,
      suffix: "pts",
    },
  ];

  // ---- signals ----
  const newFoyers4w =
    acquisitionSeries.slice(-4).reduce((s, w) => s + w.foyers, 0) / Math.max(1, Math.min(4, acquisitionSeries.length));
  const signals: Signal[] = [
    {
      value: fr(k.dormant_households ?? 0),
      label: "Foyers dormants",
      hint: "actifs il y a +30 j, silencieux depuis",
      warn: true,
    },
    {
      value: String((Number(depth) || 0).toFixed(1)).replace(".", ","),
      label: "Recettes / jour actif",
      hint: "profondeur d'usage moyenne",
    },
    {
      value: fr(newFoyers4w),
      label: "Nouveaux foyers / sem.",
      hint: "moyenne sur 4 semaines",
    },
    {
      value: "à venir",
      label: "Coût IA estimé / mois",
      hint: "instrumentation des appels OpenAI à venir",
    },
  ];

  return {
    kpis,
    signals,
    wauMau,
    parc,
    acquisition: acquisitionSeries,
    recipeCreation,
    householdSize: householdSizeDist,
    recipesPerHousehold,
    loginFrequency,
    addMethods,
    addMethodsOverTime,
    platforms,
    topHouseholds: topHouseholdsList,
    retention,
    retentionCohorts,
    aiPipeline,
    activationPct,
    coveragePct,
    depth: Number(depth) || 0,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
