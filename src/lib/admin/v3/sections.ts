// Fonctions PURES extraites d'assembleV3 (revue 2026-09-12, lot 6) : chacune
// prend des lignes brutes + une fenêtre et renvoie une série prête pour la
// page et le digest. assembleV3 reste l'unique assembleur (page + digest) ;
// ici on rend testables une à une les médianes, fenêtres glissantes, parts
// arrondies et cohortes en layer cake.

import { addDays } from "@/lib/admin/v3/weeks";
import type { HotIndicator, WeeklyActiveRow, WeeklyRecipesRow } from "@/lib/admin/v3/assemble";

export const num = (v: unknown) => Number(v) || 0;

/** Liste des `n` jours ISO se terminant à `end` inclus, du plus ancien au plus récent. */
export function dayList(n: number, end: string): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, -(n - 1 - i)));
}

/** Médiane (0 pour une liste vide). */
export function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  if (!a.length) return 0;
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
}

/**
 * Parts en % arrondies qui somment exactement à 100 : la dernière clé non
 * nulle absorbe l'écart d'arrondi. `total` 0 → toutes les parts à 0.
 */
export function roundedShares(
  values: Record<string, number>,
  keys: string[],
): Record<string, number> {
  const tot = keys.reduce((a, k) => a + (values[k] ?? 0), 0);
  const out: Record<string, number> = {};
  let acc = 0;
  let lastKey: string | null = null;
  for (const k of keys) {
    const v = tot ? Math.round(((values[k] ?? 0) / tot) * 100) : 0;
    out[k] = v;
    acc += v;
    if (v > 0) lastKey = k;
  }
  if (lastKey && acc !== 100) out[lastKey] += 100 - acc;
  return out;
}

/** `dd/mm` d'un jour ISO. */
export const dayLabel = (isoDay: string) => isoDay.slice(8, 10) + "/" + isoDay.slice(5, 7);

/**
 * Séries hebdo des personnes actives : total et « engagées » par fin de
 * semaine, plus le layer cake semaine × mois d'arrivée (les mois au-delà des
 * 4 plus récents sont regroupés sous le 5e plus ancien).
 */
export function weeklyActiveSeries(rows: WeeklyActiveRow[], weekStarts: string[]) {
  const activeByWeek = new Map<string, number>();
  const engagedByWeek = new Map<string, number>();
  const cohortMonths = new Set<string>();
  for (const r of rows) {
    activeByWeek.set(r.week_end, (activeByWeek.get(r.week_end) ?? 0) + num(r.active));
    engagedByWeek.set(r.week_end, (engagedByWeek.get(r.week_end) ?? 0) + num(r.engaged));
    cohortMonths.add(r.cohort_month.slice(0, 7));
  }
  const weekEnds = weekStarts.map((s) => addDays(s, 6));
  const months = [...cohortMonths].sort();
  const cakeMonths = months.length > 5 ? [...months.slice(-4)] : months;
  const olderKey = months.length > 5 ? months[months.length - 5] : null;
  const cakeKeys = olderKey ? [olderKey, ...cakeMonths] : cakeMonths;
  const cake = weekEnds.map((we, i) => {
    const row: Record<string, number | string> = { label: dayLabel(weekStarts[i]), weekEnd: we };
    for (const k of cakeKeys) row[k] = 0;
    for (const r of rows) {
      if (r.week_end !== we) continue;
      const m = r.cohort_month.slice(0, 7);
      const key = olderKey && m <= olderKey ? olderKey : m;
      row[key] = num(row[key]) + num(r.active);
    }
    return row;
  });
  return {
    activeByWeek,
    engagedByWeek,
    weekEnds,
    activeSeries: weekEnds.map((we) => activeByWeek.get(we) ?? 0),
    cake,
    cakeKeys,
    /** Clé du regroupement « mois plus anciens », null si ≤ 5 mois. */
    olderKey,
  };
}

/** Recettes par semaine (total) et mix des méthodes d'ajout en parts arrondies. */
export function weeklyRecipesSeries(
  rows: WeeklyRecipesRow[],
  weekStarts: string[],
  methods: string[],
) {
  const recipesByWeek = new Map<string, number>();
  const mixByWeek = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const ws = r.week_start.slice(0, 10);
    recipesByWeek.set(ws, (recipesByWeek.get(ws) ?? 0) + num(r.recipes));
    const m = mixByWeek.get(ws) ?? {};
    m[r.source] = (m[r.source] ?? 0) + num(r.recipes);
    mixByWeek.set(ws, m);
  }
  const methodMix = weekStarts.map((s) => {
    const m = mixByWeek.get(s) ?? {};
    const total = methods.reduce((a, k) => a + (m[k] ?? 0), 0);
    return { label: dayLabel(s), total, ...roundedShares(m, methods) } as Record<
      string,
      number | string
    >;
  });
  return { recipesByWeek, methodMix };
}

/**
 * Indicateur « chaud » d'un compte quotidien : total (ou moyenne) des 7 jours
 * finissant à `end`, repère = médiane des 3 fenêtres de 7 jours précédentes,
 * 14 barres avec, pour chaque jour, la médiane du même jour de semaine sur 4
 * semaines.
 */
export function hotIndicator(
  id: string,
  label: string,
  get: (day: string) => number,
  end: string,
  opts: { avg?: boolean; unit?: string; hint?: string } = {},
): HotIndicator {
  const win = (e: string) => {
    const vals = dayList(7, e).map(get);
    const tot = vals.reduce((a, b) => a + b, 0);
    return opts.avg ? +(tot / 7).toFixed(1) : tot;
  };
  const value = win(end);
  const ref = +median([
    win(addDays(end, -7)),
    win(addDays(end, -14)),
    win(addDays(end, -21)),
  ]).toFixed(1);
  const barDays = dayList(14, end);
  const barRefs = barDays.map((d) => median([7, 14, 21, 28].map((k) => get(addDays(d, -k)))));
  return {
    id,
    label,
    value,
    ref,
    trend: value > ref ? "up" : value < ref ? "down" : "flat",
    bars: barDays.map(get),
    barDays,
    barRefs,
    unit: opts.unit,
    hint: opts.hint,
  };
}

/** Taux en % à une décimale, null sans dénominateur. */
export const pct1 = (n: number, d: number) => (d > 0 ? +((n / d) * 100).toFixed(1) : null);
