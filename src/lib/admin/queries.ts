import { createServerClient } from "@/lib/supabase/server";
import { getBilledOpenAiSpend } from "@/lib/admin/openai-costs";
import { resolvePeriod, type PeriodKey } from "@/lib/admin/periods";
import {
  PALETTE,
  METHOD_LABELS,
  METHOD_COLORS,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
} from "@/lib/admin/palette";

// AI-cost usage groups (OCR / metadata / image / import) — labels + colours.
const COST_GROUPS = [
  { key: "ocr", label: "Lecture OCR", color: PALETTE.ochre },
  { key: "metadata", label: "Métadonnées", color: PALETTE.sage },
  { key: "image", label: "Génération image", color: PALETTE.terracotta },
  { key: "import", label: "Import URL / vocal", color: PALETTE.clay },
] as const;

// Maps a raw ai_costs.call_type to its display group.
function costGroup(callType: string): (typeof COST_GROUPS)[number]["key"] {
  if (callType === "ocr") return "ocr";
  if (callType === "metadata") return "metadata";
  if (callType === "image" || callType === "image_prompt") return "image";
  return "import"; // import_url | import_voice | transcription
}

const usd = (n: number) => `$${n.toFixed(2)}`;

// ---------------------------------------------------------------------------
// Server-side data layer for the usage dashboard. Calls the analytics_* RPC
// functions in parallel and shapes the rows into the structures the chart
// components expect. Demo/seed exclusion happens inside the SQL functions.
//
// Filters: period (from/to), platform, household IDs. The all-time KPI totals
// are intentionally NOT period-filtered (parc).
// ---------------------------------------------------------------------------

export type DashboardFilters = {
  period?: PeriodKey; // rolling window for trend charts & period-sensitive metrics
  platform?: "ios" | "android" | "web" | null;
  householdIds?: string[] | null;
};

export type HouseholdOption = { id: string; name: string };

// Households for the filter-bar picker — real foyers only (demo/test excluded),
// alphabetical. Kept separate from getDashboardData since the list is filter-
// independent (you always pick from every household).
export async function getHouseholdsForPicker(): Promise<HouseholdOption[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("households")
    .select("id, name")
    .eq("is_demo", false)
    .not("name", "ilike", "test%")
    .order("name", { ascending: true });
  if (error) throw new Error(`households_picker: ${error.message}`);
  return (data ?? []).map((h) => ({ id: String(h.id), name: String(h.name ?? "Sans nom") }));
}

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

export type EnrichmentFailure = {
  id: string;
  title: string;
  household: string;
  failedPart: string;
  updatedAt: string;
};

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const fr = (n: number) => Math.round(n).toLocaleString("fr-FR");
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

// Hard ceiling on the resolved "Depuis le début" window, so a stray early
// timestamp can't blow up the per-day generate_series in the RPCs (~3 years).
const MAX_DAYS = 1100;
// Unit-economics windows (AI cost summary, billed spend) stay a trailing 30 d
// snapshot regardless of the selected period — their cards are labelled "30 j".
const COST_DAYS = 30;

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

  const rpc = <T = Row[]>(fn: string, params: Record<string, unknown> = {}) =>
    supabase.rpc(fn, params).then(({ data, error }) => {
      if (error) throw new Error(`${fn}: ${error.message}`);
      return (data ?? []) as T;
    });

  const today = new Date();

  // Resolve the selected period into a concrete day window. "Depuis le début"
  // (days = null) is resolved to the age of the oldest real household.
  const period = resolvePeriod(filters.period);
  let days = period.days;
  if (days == null) {
    const { data: oldest } = await supabase
      .from("households")
      .select("created_at")
      .eq("is_demo", false)
      .not("name", "ilike", "test%")
      .order("created_at", { ascending: true })
      .limit(1);
    const first = oldest?.[0]?.created_at ? new Date(oldest[0].created_at as string) : null;
    const age = first ? Math.ceil((today.getTime() - first.getTime()) / 86_400_000) + 1 : 365;
    days = Math.min(MAX_DAYS, Math.max(90, age));
  }
  const months = Math.max(1, Math.ceil(days / 30));

  // Period window start, and a ≥60 d window for the recipe-creation series so
  // the "Recettes créées 30 j" KPI keeps its 30-vs-prior-30 delta even at 1 mois.
  const from60 = new Date(today);
  from60.setUTCDate(from60.getUTCDate() - 60);
  const fromPeriod = new Date(today);
  fromPeriod.setUTCDate(fromPeriod.getUTCDate() - days);
  const fromRecipes = new Date(today);
  fromRecipes.setUTCDate(fromRecipes.getUTCDate() - Math.max(days, 60));

  const [
    kpisRow,
    recipesDaily,
    enrichment,
    activation,
    activeDaily,
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
    enrichmentFailureRows,
    aiCostDailyRows,
    aiCostSummaryRows,
    billedSpend,
  ] = await Promise.all([
    rpc("analytics_kpis", { p_household_ids: hh }),
    rpc("analytics_recipes_created_daily", { p_from: ISO(fromRecipes), p_household_ids: hh, p_platform: plat }),
    rpc("analytics_enrichment", { p_household_ids: hh }),
    rpc("analytics_activation", {}),
    rpc("analytics_active_daily", { p_days: days, p_platform: plat, p_household_ids: hh }),
    rpc("analytics_cumulative_parc_daily", { p_days: days }),
    rpc("analytics_acquisition_daily", { p_days: days }),
    rpc("analytics_household_size_dist", {}),
    rpc("analytics_recipes_per_household_dist", { p_household_ids: hh }),
    rpc("analytics_source_mix", { p_from: ISO(fromPeriod), p_household_ids: hh, p_platform: plat }),
    rpc("analytics_source_mix_monthly", { p_months: months, p_household_ids: hh }),
    rpc("analytics_top_households", { p_limit: 8 }),
    rpc("analytics_retention_cohorts", { p_cohorts: 3, p_max_week: 8 }),
    rpc("analytics_login_frequency", { p_days: days, p_platform: plat, p_household_ids: hh }),
    rpc<number>("analytics_depth", { p_days: days, p_household_ids: hh }),
    rpc("analytics_recipes_by_platform", { p_household_ids: hh }),
    // Direct table read (no RPC): recipes whose AI pipeline failed, so the
    // dashboard surfaces what would otherwise only live in Sentry.
    supabase
      .from("recipes")
      .select("id, title, enrichment_status, image_status, updated_at, households(name)")
      .or("enrichment_status.eq.failed,image_status.eq.failed")
      .eq("is_seed", false)
      .order("updated_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) throw new Error(`enrichment_failures: ${error.message}`);
        return (data ?? []) as Row[];
      }),
    rpc("analytics_ai_cost_daily", { p_days: days }),
    rpc("analytics_ai_cost_summary", { p_days: COST_DAYS }),
    // Org-wide billed spend (USD, 30d) from the Costs API — null if no admin
    // key. Reconciles against the instrumented total to catch untracked spend.
    getBilledOpenAiSpend(COST_DAYS),
  ]);

  const k = (kpisRow[0] ?? {}) as Record<string, number>;

  // ---- AI cost (USD) ----
  type CostDay = { ocr: number; metadata: number; image: number; import: number };
  const emptyCostDay = (): CostDay => ({ ocr: 0, metadata: 0, image: 0, import: 0 });
  const costByDay = new Map<string, CostDay>();
  for (const r of aiCostDailyRows as Row[]) {
    const day = r.day as string;
    if (!costByDay.has(day)) costByDay.set(day, emptyCostDay());
    costByDay.get(day)![costGroup(r.call_type as string)] += Number(r.cost_usd) || 0;
  }
  const aiCostDaily = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    const iso = ISO(d);
    const c = costByDay.get(iso) ?? emptyCostDay();
    return {
      label: shortLabel(iso),
      ...c,
      total: +(c.ocr + c.metadata + c.image + c.import).toFixed(4),
    };
  });

  const cs = (aiCostSummaryRows[0] ?? {}) as Record<string, number | null>;
  const csNum = (key: string) => Number(cs[key] ?? 0) || 0;
  const aiCostByType = COST_GROUPS.map((g) => ({
    name: g.label,
    key: g.key,
    color: g.color,
    value: +csNum(`${g.key}_usd`).toFixed(4),
  })).filter((d) => d.value > 0);

  const aiCost = {
    daily: aiCostDaily,
    byType: aiCostByType,
    total30d: csNum("total_usd"),
    costPerRecipe: csNum("cost_per_recipe"),
    costPerImage: csNum("cost_per_image"),
    recipesCosted: csNum("recipes_costed"),
    imagesCount: csNum("images_count"),
    callsTotal: csNum("calls_total"),
    billed30d: typeof billedSpend === "number" ? billedSpend : null,
  };

  // ---- time series (one point per day) ----
  const wauMau = (activeDaily as Row[]).map((r) => ({
    label: shortLabel(r.day as string),
    wau: Number(r.wau),
    mau: Number(r.mau),
    stickiness: r.stickiness == null ? 0 : Number(r.stickiness),
  }));

  const parc = (cumulative as Row[]).map((r) => ({
    label: shortLabel(r.day as string),
    foyers: Number(r.foyers),
    appareils: Number(r.appareils),
    recettes: Number(r.recettes),
  }));

  const acquisitionSeries = (acquisition as Row[]).map((r) => ({
    label: shortLabel(r.day as string),
    devices: Number(r.devices),
    foyers: Number(r.foyers),
  }));

  // daily recipe creation (analytics_recipes_created_daily is already per-day,
  // but only returns days with ≥1 recipe — zero-fill the gaps for a clean line)
  const recipeByDay = new Map<string, number>();
  for (const r of recipesDaily as Row[]) {
    recipeByDay.set(r.day as string, Number(r.recipes));
  }
  const recipeCreation = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    const iso = ISO(d);
    return { label: shortLabel(iso), total: recipeByDay.get(iso) ?? 0 };
  });

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
  const newFoyersWeek = acquisitionSeries.slice(-7).reduce((s, d) => s + d.foyers, 0);
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
      value: fr(newFoyersWeek),
      label: "Nouveaux foyers / sem.",
      hint: "total des 7 derniers jours",
    },
    {
      value: usd(aiCost.total30d),
      label: "Coût IA / 30 j",
      hint: aiCost.billed30d != null
        ? `facturé OpenAI : ${usd(aiCost.billed30d)} (org. entière)`
        : "somme instrumentée des appels OpenAI",
    },
  ];

  const enrichmentFailures: EnrichmentFailure[] = (enrichmentFailureRows as Row[]).map((r) => {
    const meta = r.enrichment_status === "failed";
    const image = r.image_status === "failed";
    const hhRel = r.households as { name?: string } | { name?: string }[] | null;
    const household = (Array.isArray(hhRel) ? hhRel[0]?.name : hhRel?.name) ?? "—";
    return {
      id: String(r.id),
      title: String(r.title ?? "Sans titre"),
      household,
      failedPart: meta && image ? "métadonnées + image" : meta ? "métadonnées" : "image",
      updatedAt: shortLabel(String(r.updated_at).slice(0, 10)),
    };
  });

  return {
    kpis,
    signals,
    enrichmentFailures,
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
    aiCost,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
