import { createServerClient } from "@/lib/supabase/server";
import { getBilledOpenAiSpend } from "@/lib/admin/openai-costs";
import { resolvePeriod, type PeriodKey } from "@/lib/admin/periods";
import {
  METRIC_EPOCHS,
  clampWindow,
  windowLabel,
  windowPredatesEpoch,
} from "@/lib/admin/epochs";
import {
  PALETTE,
  METHOD_LABELS,
  METHOD_COLORS,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
} from "@/lib/admin/palette";

// AI-cost usage groups — labels + colours. The single "import" bucket is split
// into its distinct voies so the dashboard tracks direct / Instagram / crawler
// URL imports separately (plus voice). Keys match analytics_ai_cost_summary's
// `<key>_usd` columns and the ChartAiCostTrend dataKeys. 'demo' aggregates the
// demo household's whole spend (excluded from the real groups since 019).
const COST_GROUPS = [
  { key: "ocr", label: "Lecture OCR", color: PALETTE.ochre },
  { key: "metadata", label: "Métadonnées", color: PALETTE.sage },
  { key: "image", label: "Génération image", color: PALETTE.terracotta },
  { key: "import_url", label: "Import web", color: PALETTE.clay },
  { key: "import_instagram", label: "Import Instagram", color: PALETTE.olive },
  { key: "import_crawler", label: "Import web (anti-blocage)", color: PALETTE.oliveSoft },
  { key: "import_voice", label: "Import vocal", color: PALETTE.oliveDeep },
] as const;

type CostGroupKey = (typeof COST_GROUPS)[number]["key"];

// Maps a raw ai_costs.call_type to its display group.
function costGroup(callType: string): CostGroupKey {
  if (callType === "ocr") return "ocr";
  if (callType === "metadata") return "metadata";
  if (callType === "image" || callType === "image_prompt") return "image";
  if (callType === "import_instagram") return "import_instagram";
  if (callType === "import_url_crawler") return "import_crawler";
  if (callType === "import_voice" || callType === "transcription") return "import_voice";
  return "import_url"; // import_url (direct fetch) — the default
}

const usd = (n: number) => `$${n.toFixed(2)}`;

// ---------------------------------------------------------------------------
// Server-side data layer for the usage dashboard v2. Calls the analytics_* RPC
// functions (033: owner grain + demo funnel) in parallel and shapes the rows
// into the structures the chart components expect. Demo/seed exclusion happens
// inside the SQL functions; the demo funnel has its own dedicated functions.
//
// Filters: period (from/to), platform, carnet IDs. The all-time KPI totals are
// intentionally NOT period-filtered (parc). Cards whose RPC ignores the
// platform/carnet filters are badged « global » in the page.
// ---------------------------------------------------------------------------

export type DashboardFilters = {
  period?: PeriodKey; // rolling window for trend charts & period-sensitive metrics
  platform?: "ios" | "android" | "web" | null;
  householdIds?: string[] | null;
};

export type HouseholdOption = { id: string; name: string };

// Carnets for the filter-bar picker — real carnets only (demo/test excluded),
// alphabetical. Kept separate from getDashboardData since the list is filter-
// independent (you always pick from every carnet).
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

export type FunnelStep = { label: string; value: number; pct: number };

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
// Unit-economics & funnel-summary windows stay a trailing 30 d snapshot
// regardless of the selected period — their cards are labelled "30 j".
const COST_DAYS = 30;
// Recovery funnel window (tokens live in stats_daily — see 032).
const RECOVERY_DAYS = 90;

function shortLabel(isoDay: string): string {
  const d = new Date(isoDay + "T00:00:00Z");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
}

function monthLabel(isoDay: string): string {
  const d = new Date(isoDay + "T00:00:00Z");
  return d.toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" });
}

// Median time-to-convert, human-readable ("— " when no conversion yet).
function formatHours(hours: number | null): string {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours < 1) return "< 1 h";
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${(hours / 24).toFixed(1).replace(".", ",")} j`;
}

const spark = (vals: number[]) => vals.slice(-14).map((v) => ({ v }));

// Oldest→newest ISO day grid for zero-filling sparse per-day series.
function dayGrid(days: number, today: Date): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    return ISO(d);
  });
}

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
  // (days = null) is resolved to the age of the oldest real carnet.
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

  // Period window start, and ≥60 d windows so the 30-vs-prior-30 deltas keep
  // working even at « 1 mois ». Activation KPI reads the last 8 weekly cohorts.
  const from60 = new Date(today);
  from60.setUTCDate(from60.getUTCDate() - 60);
  const fromPeriod = new Date(today);
  fromPeriod.setUTCDate(fromPeriod.getUTCDate() - days);
  const fromRecipes = new Date(today);
  fromRecipes.setUTCDate(fromRecipes.getUTCDate() - Math.max(days, 60));
  const fromActivation = new Date(today);
  fromActivation.setUTCDate(fromActivation.getUTCDate() - 56);
  const funnelDays = Math.max(days, 60);

  // Fenêtre du taux de conversion clampée à la naissance du marqueur (032) :
  // sans clamp, les jours d'essais antérieurs au marqueur gonflent le
  // dénominateur alors qu'aucune conversion n'y était mesurable — le taux
  // serait mécaniquement sous-estimé jusqu'à ce que 30 j de mesure existent.
  const convWindow = clampWindow(COST_DAYS, "conversionMarker", today);

  const [
    kpisRow,
    recipesDaily,
    enrichment,
    activation,
    activeDaily,
    cumulative,
    acquisition,
    carnetPeople,
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
    demoFunnelRows,
    demoSummaryRows,
    ttcRows,
    carnetsPerOwnerRows,
    devicesPerOwnerRows,
    guestRows,
    recoveryRows,
    sharingRows,
    aiCostDemoRows,
    adoptionRows,
    demoActivityRows,
  ] = await Promise.all([
    rpc("analytics_kpis", { p_household_ids: hh }),
    rpc("analytics_recipes_created_daily", { p_from: ISO(fromRecipes), p_household_ids: hh, p_platform: plat }),
    rpc("analytics_enrichment", { p_household_ids: hh }),
    rpc("analytics_activation", { p_from: ISO(fromActivation) }),
    rpc("analytics_active_daily", { p_days: days, p_platform: plat, p_household_ids: hh }),
    rpc("analytics_cumulative_parc_daily", { p_days: days }),
    rpc("analytics_acquisition_daily", { p_days: days }),
    rpc("analytics_carnet_people_dist", {}),
    rpc("analytics_recipes_per_household_dist", { p_household_ids: hh }),
    rpc("analytics_source_mix", { p_from: ISO(fromPeriod), p_household_ids: hh, p_platform: plat }),
    rpc("analytics_source_mix_monthly", { p_months: months, p_household_ids: hh }),
    rpc("analytics_top_households", { p_limit: 20 }),
    rpc("analytics_retention_cohorts", { p_cohorts: 3, p_max_week: 8 }),
    rpc("analytics_login_frequency", { p_days: days, p_platform: plat, p_household_ids: hh }),
    rpc<number>("analytics_depth", { p_days: days, p_household_ids: hh }),
    rpc("analytics_recipes_by_platform", { p_household_ids: hh }),
    // Direct table read (no RPC): recipes whose AI pipeline failed, so the
    // dashboard surfaces what would otherwise only live in Sentry. Demo/test
    // carnets excluded (v2 fix — this was the only block without the filter).
    supabase
      .from("recipes")
      .select("id, title, enrichment_status, image_status, updated_at, households!inner(name, is_demo)")
      .or("enrichment_status.eq.failed,image_status.eq.failed")
      .eq("is_seed", false)
      .eq("households.is_demo", false)
      .not("households.name", "ilike", "test%")
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
    rpc("analytics_demo_funnel", { p_days: funnelDays }),
    rpc("analytics_demo_summary", { p_days: convWindow.days }),
    rpc("analytics_demo_time_to_convert", {}),
    rpc("analytics_carnets_per_owner", {}),
    rpc("analytics_devices_per_owner", {}),
    rpc("analytics_guest_adoption", {}),
    rpc("analytics_recovery", { p_days: RECOVERY_DAYS }),
    rpc("analytics_sharing", { p_days: COST_DAYS }),
    rpc("analytics_ai_cost_demo_daily", { p_days: days }),
    // Adoption sur la cohorte EXPOSÉE : personnes/carnets créés depuis les
    // Lots 1-4 (email, profil, invité, multi-carnet) — le % global mélange
    // les utilisateurs d'avant la feature et masque sa vraie santé.
    rpc("analytics_adoption_since", {
      p_owners_since: METRIC_EPOCHS.foyerFeatures,
      p_carnets_since: METRIC_EPOCHS.foyerFeatures,
    }),
    // Demo activity per day (recipes added before the nightly purge) — direct
    // read of the 032 rollup table; today's rows appear after the next rollup.
    supabase
      .from("stats_daily")
      .select("day, demo_recipes_added")
      .gte("day", ISO(fromPeriod))
      .order("day", { ascending: true })
      .then(({ data, error }) => {
        if (error) throw new Error(`stats_daily: ${error.message}`);
        return (data ?? []) as Row[];
      }),
  ]);

  const k = (kpisRow[0] ?? {}) as Record<string, number>;
  const demoSum = (demoSummaryRows[0] ?? {}) as Record<string, number | null>;
  const rec = (recoveryRows[0] ?? {}) as Record<string, number>;
  const guest = (guestRows[0] ?? {}) as Record<string, number>;
  const sharing = (sharingRows[0] ?? {}) as Record<string, number>;
  const adopt = (adoptionRows[0] ?? {}) as Record<string, number>;

  // Libellés de fenêtre honnêtes (« 30 j » ou « depuis le 14 août ») pour les
  // métriques nées avec la 032 — la valeur, elle, est toujours juste (rien
  // n'existait avant), seul le libellé surpromettrait.
  const epochShort = (e: keyof typeof METRIC_EPOCHS) => shortLabel(METRIC_EPOCHS[e]);
  const windows = {
    conversion: windowLabel(COST_DAYS, "conversionMarker", today),
    tokens: windowLabel(RECOVERY_DAYS, "conversionMarker", today),
    moves: windowLabel(COST_DAYS, "conversionMarker", today),
  };

  // ---- funnel démo → carnet ----
  const demoDaily = (demoFunnelRows as Row[]).map((r) => ({
    day: r.day as string,
    label: shortLabel(r.day as string),
    trials: Number(r.trials),
    conversions: Number(r.conversions),
  }));
  // The RPC window is ≥60 d for deltas; the chart shows the selected period.
  const demoDailyChart = demoDaily.slice(-days);

  const trials30 = Number(demoSum.trials ?? 0);
  const conversions30 = Number(demoSum.conversions ?? 0);
  const conversionPct = demoSum.conversion_pct == null ? null : Number(demoSum.conversion_pct);
  const funnel: FunnelStep[] = [
    { label: "Essais démo", value: trials30, pct: 100 },
    { label: "Conversions — 1er carnet", value: conversions30, pct: pct(conversions30, trials30) },
    {
      label: "Activés — ≥ 1 recette à 7 j",
      value: Number(demoSum.activated_7d ?? 0),
      pct: pct(Number(demoSum.activated_7d ?? 0), trials30),
    },
  ];

  const ttc = (ttcRows as Row[]).map((r) => ({ bin: r.bin as string, value: Number(r.owners) }));
  const ttcTotal = ttc.reduce((s, b) => s + b.value, 0);

  // Repères/zones du graphe essais & conversions : barre à la naissance du
  // marqueur de conversion, zone « non mesuré » avant le début du comptage des
  // essais (rollup) — seulement si la fenêtre affichée les contient.
  const windowStartIso = demoDailyChart[0]?.day ?? ISO(today);
  const demoConversionMarker =
    METRIC_EPOCHS.conversionMarker >= windowStartIso ? epochShort("conversionMarker") : null;
  const demoNotMeasured =
    windowStartIso < METRIC_EPOCHS.demoTrials
      ? { from: demoDailyChart[0].label, to: epochShort("demoTrials") }
      : null;

  const demoActivityByDay = new Map<string, number>();
  for (const r of demoActivityRows as Row[]) {
    demoActivityByDay.set(String(r.day), Number(r.demo_recipes_added) || 0);
  }
  const demoActivityDaily = dayGrid(Math.min(days, 30), today).map((iso) => ({
    label: shortLabel(iso),
    recettes: demoActivityByDay.get(iso) ?? 0,
  }));

  // 30-vs-prior-30 deltas for the funnel KPIs — seulement quand la fenêtre
  // précédente est ENTIÈREMENT mesurée (60 j depuis la naissance de la
  // métrique), sinon on comparerait de la mesure à du vide.
  const sumRange = (rows: typeof demoDaily, from: number, to: number, key: "trials" | "conversions") =>
    rows.slice(from, to).reduce((s, r) => s + r[key], 0);
  const n = demoDaily.length;
  const trialsMeasured60 = !windowPredatesEpoch(60, "demoTrials", today);
  const convMeasured60 = !windowPredatesEpoch(60, "conversionMarker", today);
  const trialsPrev30 = trialsMeasured60 && n >= 60 ? sumRange(demoDaily, n - 60, n - 30, "trials") : 0;
  const trialsDelta =
    trialsPrev30 >= 5 ? +(((trials30 - trialsPrev30) / trialsPrev30) * 100).toFixed(0) : undefined;
  const convPrev30 = convMeasured60 && n >= 60 ? sumRange(demoDaily, n - 60, n - 30, "conversions") : 0;
  const convPctPrev = convMeasured60 && trialsPrev30 > 0 ? pct(convPrev30, trialsPrev30) : null;
  const convDelta =
    conversionPct != null && convPctPrev != null && trialsPrev30 >= 5
      ? +(conversionPct - convPctPrev).toFixed(1)
      : undefined;

  // ---- AI cost (USD) — real usage + demo overlay ----
  type CostDay = Record<CostGroupKey | "demo", number>;
  const emptyCostDay = (): CostDay =>
    Object.fromEntries([...COST_GROUPS.map((g) => [g.key, 0]), ["demo", 0]]) as CostDay;
  const costByDay = new Map<string, CostDay>();
  for (const r of aiCostDailyRows as Row[]) {
    const day = r.day as string;
    if (!costByDay.has(day)) costByDay.set(day, emptyCostDay());
    costByDay.get(day)![costGroup(r.call_type as string)] += Number(r.cost_usd) || 0;
  }
  for (const r of aiCostDemoRows as Row[]) {
    const day = r.day as string;
    if (!costByDay.has(day)) costByDay.set(day, emptyCostDay());
    costByDay.get(day)!.demo += Number(r.cost_usd) || 0;
  }
  const aiCostDaily = dayGrid(days, today).map((iso) => {
    const c = costByDay.get(iso) ?? emptyCostDay();
    return {
      label: shortLabel(iso),
      ...c,
      total: +[...COST_GROUPS.map((g) => c[g.key]), c.demo].reduce((s, v) => s + v, 0).toFixed(4),
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

  // Demo spend share over the same trailing window as the real summary
  // (analytics_ai_cost_summary: created_at::date >= current_date - 30) —
  // date-only comparison, sinon l'heure du rendu exclut le jour de bord.
  const costCutoffIso = (() => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - COST_DAYS);
    return ISO(d);
  })();
  const demoCost30 = (aiCostDemoRows as Row[])
    .filter((r) => String(r.day) >= costCutoffIso)
    .reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const totalWithDemo30 = csNum("total_usd") + demoCost30;

  const aiCost = {
    daily: aiCostDaily,
    byType: aiCostByType,
    total30d: csNum("total_usd"),
    demo30d: demoCost30,
    demoSharePct: Math.round(pct(demoCost30, totalWithDemo30)),
    costPerRecipe: csNum("cost_per_recipe"),
    costPerImage: csNum("cost_per_image"),
    recipesCosted: csNum("recipes_costed"),
    imagesCount: csNum("images_count"),
    callsTotal: csNum("calls_total"),
    billed30d: typeof billedSpend === "number" ? billedSpend : null,
  };

  // ---- time series (one point per day) ----
  const wauMau = (activeDaily as Row[]).map((r) => ({
    day: r.day as string,
    label: shortLabel(r.day as string),
    wau: Number(r.wau),
    mau: Number(r.mau),
    mauDevices: Number(r.mau_devices),
    stickiness: r.stickiness == null ? 0 : Number(r.stickiness),
  }));
  // Reference marker (correctif ping + modèle owners) — only when in window.
  const activityMarker = wauMau.some((w) => w.day === METRIC_EPOCHS.ownerGrain)
    ? epochShort("ownerGrain")
    : null;

  // Zone « non mesuré » du coût IA (table ai_costs née le 2026-06-16) — pour
  // les longues périodes qui remontent avant.
  const costWindowStartIso = ISO(
    (() => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - (days - 1));
      return d;
    })(),
  );
  const aiCostNotMeasured =
    costWindowStartIso < METRIC_EPOCHS.aiCosts
      ? { from: shortLabel(costWindowStartIso), to: epochShort("aiCosts") }
      : null;

  const parc = (cumulative as Row[]).map((r) => ({
    label: shortLabel(r.day as string),
    personnes: Number(r.owners),
    carnets: Number(r.carnets),
  }));

  const acquisitionSeries = (acquisition as Row[]).map((r) => ({
    label: shortLabel(r.day as string),
    personnes: Number(r.new_owners),
    carnets: Number(r.new_carnets),
    premiers: Number(r.first_carnets),
  }));

  // daily recipe creation (analytics_recipes_created_daily is already per-day,
  // but only returns days with ≥1 recipe — zero-fill the gaps for a clean line)
  const recipeByDay = new Map<string, number>();
  for (const r of recipesDaily as Row[]) {
    recipeByDay.set(r.day as string, Number(r.recipes));
  }
  const recipeCreation = dayGrid(days, today).map((iso) => ({
    label: shortLabel(iso),
    total: recipeByDay.get(iso) ?? 0,
  }));

  // ---- distributions (grain personne / carnet) ----
  const loginFrequency = (loginFreq as Row[]).map((r) => ({
    bin: r.bin as string,
    value: Number(r.owners),
  }));

  const carnetsPerOwner = (carnetsPerOwnerRows as Row[]).map((r) => ({
    bin: `${r.bucket}${r.bucket === "1" ? " carnet" : " carnets"}`,
    value: Number(r.owners),
  }));
  const multiCarnetOwners = (carnetsPerOwnerRows as Row[])
    .filter((r) => r.bucket !== "1")
    .reduce((s, r) => s + Number(r.owners), 0);
  const carnetOwnersTotal = (carnetsPerOwnerRows as Row[]).reduce((s, r) => s + Number(r.owners), 0);
  const multiCarnetPct = Math.round(pct(multiCarnetOwners, carnetOwnersTotal));

  const devicesPerOwner = (devicesPerOwnerRows as Row[]).map((r) => ({
    bin: r.bucket as string,
    value: Number(r.owners),
  }));

  const peoplePerCarnet = (carnetPeople as Row[]).map((r) => ({
    bin: `${r.bucket}${r.bucket === "1" ? " pers." : ""}`,
    membres: Number(r.members),
    invites: Number(r.guests),
  }));

  const recipesPerHousehold = (recipesPerHH as Row[]).map((r) => ({
    bin: r.bucket as string,
    value: Number(r.households),
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
  // Every real method always appears in the legend, so an absent method reads
  // as an explicit "0 %" rather than "not counted". 'unknown' stays data-driven.
  if (methodTotal > 0) {
    for (const key of Object.keys(METHOD_LABELS) as (keyof typeof METHOD_LABELS)[]) {
      if (key !== "unknown" && !addMethods.some((m) => m.key === key)) {
        addMethods.push({ name: METHOD_LABELS[key], key, value: 0, color: METHOD_COLORS[key] });
      }
    }
  }

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
        shared: share("shared"),
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

  // ---- top carnets ----
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
  // 'done' (posé par la copie de recette partagée, 026) compte comme un succès :
  // la recette copiée arrive déjà enrichie. C'était le trou qui diluait la
  // couverture IA en v1.
  const enrichRows = enrichment as Row[];
  const enr = (kind: string, statuses: string[]) =>
    enrichRows
      .filter((r) => r.kind === kind && statuses.includes(r.status as string))
      .reduce((s, r) => s + Number(r.recipes), 0);
  const enrTotal = enrichRows.filter((r) => r.kind === "enrichment").reduce((s, r) => s + Number(r.recipes), 0);
  const enrSuccess = enr("enrichment", ["enriched", "done"]);
  const enrFailed = enr("enrichment", ["failed"]);
  const coveragePct = Math.round(pct(enrSuccess, enrTotal));
  const aiPipeline = [
    { name: "Succès", value: +pct(enrSuccess, enrSuccess + enrFailed).toFixed(1), color: METHOD_COLORS.manual },
    { name: "Échec", value: +pct(enrFailed, enrSuccess + enrFailed).toFixed(1), color: PLATFORM_COLORS.web },
  ];

  // ---- activation (owner grain, last 8 weekly cohorts) ----
  const actRows = activation as Row[];
  const actOwners = actRows.reduce((s, r) => s + Number(r.owners), 0);
  const actActivated = actRows.reduce((s, r) => s + Number(r.activated), 0);
  const activationPct = Math.round(pct(actActivated, actOwners));

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

  const lastActive = wauMau[wauMau.length - 1] ?? { mau: 0, wau: 0, mauDevices: 0, stickiness: 0 };

  // ---- KPIs — ordre du parcours : acquisition → conversion → activation →
  // engagement → contenu → qualité ----
  const kpis: KpiCard[] = [
    {
      id: "trials",
      label: "Essais démo",
      sub: `acquisition — sessions démo · ${windows.conversion}`,
      value: fr(trials30),
      delta: trialsDelta,
      positive: trialsDelta == null ? undefined : trialsDelta >= 0,
      spark: spark(demoDailyChart.map((d) => d.trials)),
    },
    {
      id: "conversion",
      label: "Conversion démo → carnet",
      sub: `${windows.conversion} · ${fr(conversions30)} conversion${conversions30 > 1 ? "s" : ""} / ${fr(trials30)} essais`,
      value: conversionPct == null ? "—" : `${String(conversionPct).replace(".", ",")} %`,
      suffix: "pts",
      delta: convDelta,
      positive: convDelta == null ? undefined : convDelta >= 0,
      spark: spark(demoDailyChart.map((d) => d.conversions)),
    },
    {
      id: "activation",
      label: "Activation 7 j",
      sub: "% personnes ≥ 1 recette après 1er carnet",
      value: `${activationPct} %`,
      suffix: "pts",
    },
    {
      id: "mau",
      label: "Personnes actives",
      sub: "MAU — grain owner",
      value: fr(lastActive.mau),
      total: fr(k.owners_total ?? 0),
      spark: spark(wauMau.map((w) => w.mau)),
    },
    {
      id: "sticky",
      label: "Stickiness",
      sub: "WAU / MAU personnes",
      value: `${String(lastActive.stickiness).replace(".", ",")} %`,
      suffix: "pts",
      spark: spark(wauMau.map((w) => w.stickiness)),
    },
    {
      id: "recipes",
      label: "Recettes créées",
      sub: "contenu — 30 j",
      value: fr(recipesCur),
      total: fr(k.recipes_total ?? 0),
      delta: recipesDelta,
      positive: recipesDelta == null ? undefined : recipesDelta >= 0,
      spark: spark(recipeCreation.map((r) => r.total)),
    },
    {
      id: "coverage",
      label: "Couverture IA",
      sub: "qualité — recettes enrichies",
      value: `${coveragePct} %`,
      suffix: "pts",
    },
  ];

  // ---- signals ----
  const newCarnetsWeek = acquisitionSeries.slice(-7).reduce((s, d) => s + d.carnets, 0);
  const firstCarnetsWeek = acquisitionSeries.slice(-7).reduce((s, d) => s + d.premiers, 0);
  const signals: Signal[] = [
    {
      value: fr(k.dormant_carnets ?? 0),
      label: "Carnets dormants",
      hint: "actifs il y a +30 j, silencieux depuis (activité via memberships)",
      warn: true,
    },
    {
      value: formatHours(demoSum.median_hours_to_convert == null ? null : Number(demoSum.median_hours_to_convert)),
      label: "Délai démo → carnet (médian)",
      hint: `time-to-convert des ${fr(conversions30)} conversions · 30 j`,
    },
    {
      value: fr(newCarnetsWeek),
      label: "Nouveaux carnets / sem.",
      hint: `dont ${fr(firstCarnetsWeek)} premier${firstCarnetsWeek > 1 ? "s" : ""} carnet${firstCarnetsWeek > 1 ? "s" : ""} (7 derniers jours)`,
    },
    {
      value: usd(totalWithDemo30),
      label: "Coût IA / 30 j",
      hint:
        aiCost.demoSharePct > 0
          ? `dont ${aiCost.demoSharePct} % consommé par la démo`
          : aiCost.billed30d != null
            ? `facturé OpenAI : ${usd(aiCost.billed30d)} (org. entière)`
            : "somme instrumentée des appels OpenAI",
    },
  ];

  // ---- compte & sécurité (#14) ----
  const tokensSent = Number(rec.recovery_tokens_sent ?? 0) + Number(rec.merge_tokens_sent ?? 0);
  const tokensUsed = Number(rec.recovery_tokens_used ?? 0) + Number(rec.merge_tokens_used ?? 0);
  const tokensBurned = Number(rec.tokens_burned ?? 0);
  // « Expirés » par soustraction : les tokens encore dans leur fenêtre de
  // validité (pending) en sont retirés, sinon toute demande en cours
  // s'afficherait en échec pendant ses 15 minutes de vie.
  const tokensPending = Number(rec.tokens_pending ?? 0);
  const recovery = {
    ownersTotal: Number(rec.owners_total ?? 0),
    withEmail: Number(rec.owners_with_email ?? 0),
    withEmailPct: Math.round(pct(Number(rec.owners_with_email ?? 0), Number(rec.owners_total ?? 0))),
    namedPct: Math.round(pct(Number(rec.owners_named ?? 0), Number(rec.owners_total ?? 0))),
    merges: Number(rec.merge_tokens_used ?? 0),
    funnel: [
      { label: "Tokens émis", value: tokensSent },
      { label: "Consommés (accès récupéré)", value: tokensUsed },
      { label: "Expirés sans usage", value: Math.max(0, tokensSent - tokensUsed - tokensBurned - tokensPending) },
      { label: "Brûlés (5 essais)", value: tokensBurned },
    ],
  };

  const guestAdoption = {
    carnetsTotal: Number(guest.carnets_total ?? 0),
    withGuestPct: Math.round(pct(Number(guest.carnets_with_guest ?? 0), Number(guest.carnets_total ?? 0))),
    guestsTotal: Number(guest.guests_total ?? 0),
  };

  // Adoption sur la cohorte exposée (arrivée depuis les Lots 1-4) — le chiffre
  // qui pilote ; le % global mesure la dette du passé.
  const aOwners = Number(adopt.owners_since ?? 0);
  const aCarnets = Number(adopt.carnets_since ?? 0);
  const adoption = {
    sinceLabel: epochShort("foyerFeatures"),
    owners: aOwners,
    withEmail: Number(adopt.with_email_since ?? 0),
    withEmailPct: Math.round(pct(Number(adopt.with_email_since ?? 0), aOwners)),
    namedPct: Math.round(pct(Number(adopt.named_since ?? 0), aOwners)),
    multiCarnetPct: Math.round(pct(Number(adopt.multi_carnet_since ?? 0), aOwners)),
    carnets: aCarnets,
    withGuestPct: Math.round(pct(Number(adopt.carnets_with_guest_since ?? 0), aCarnets)),
  };

  // La fenêtre « méthodes d'ajout » remonte-t-elle avant l'enregistrement de
  // recipes.source (2026-05-30) ? Si oui, « Indéterminé » gonfle par construction.
  const methodsPredateSource = ISO(fromPeriod) < METRIC_EPOCHS.recipeSource;

  const sharingStats = {
    links: Number(sharing.links_total ?? 0),
    copies: Number(sharing.copies ?? 0),
    moves: Number(sharing.moves ?? 0),
    uptakePct: Math.round(pct(Number(sharing.copies ?? 0), Number(sharing.links_total ?? 0))),
  };

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
    // 01 — funnel démo → carnet
    funnel,
    demoDaily: demoDailyChart,
    demoConversionMarker,
    demoNotMeasured,
    ttc,
    ttcTotal,
    demoActivityDaily,
    demoFrictions: {
      aiCalls: Number(demoSum.demo_ai_calls ?? 0),
      frozenHits: Number(demoSum.frozen_hits ?? 0),
      recipesAdded: Number(demoSum.demo_recipes ?? 0),
    },
    // 02 — personnes actives
    wauMau,
    activityMarker,
    parc,
    loginFrequency,
    devicesPerOwner,
    retention,
    retentionCohorts,
    activationPct,
    depth: Number(depth) || 0,
    dormantCarnets: Number(k.dormant_carnets ?? 0),
    // 03 — carnets & cercles
    carnetsPerOwner,
    multiCarnetPct,
    peoplePerCarnet,
    guestAdoption,
    topHouseholds: topHouseholdsList,
    // 04 — contenu & partage
    recipeCreation,
    recipesPerHousehold,
    addMethods,
    addMethodsOverTime,
    sharing: sharingStats,
    // 05 — compte & sécurité
    recovery,
    adoption,
    // 06 — qualité & coût IA
    platforms,
    aiPipeline,
    coveragePct,
    aiCost,
    aiCostNotMeasured,
    // Fenêtres & époques (libellés honnêtes)
    windows,
    methodsPredateSource,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
