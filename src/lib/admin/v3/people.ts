// Façonnage des faits par personne (analytics_v3_people, migration 043) :
// cohortes, rétention glissante, activation, distributions. Module pur.
//
// Mois = 28 jours (M1 = J+28 → J+55, M2 = J+56 → J+83, M3 = J+84 → J+111),
// cohorte = mois calendaire d'arrivée. « Activée » = ≥ 3 recettes ET ≥ 1 jour
// actif après J+1, dans les 7 jours (décision Anthony, spec §4.7).

import { type Ratio, ratio } from "@/lib/admin/v3/ratio";
import { type Window, addDays, daysBetween, inWindow, weekStart, weekStarts, weeksEnding } from "@/lib/admin/v3/weeks";

export type Channel = "ios" | "android" | "web" | "invite";

export type Person = {
  id: string;
  created_at: string;
  display_name: string | null;
  has_email: boolean;
  named: boolean;
  via_demo: boolean;
  first_platform: string | null;
  channel: Channel;
  carnets: number;
  guest_of: number;
  first_method: string | null;
  first_recipe_at: string | null;
  recipes_7d: number;
  recipes_28d: number;
  recipes_total: number;
  views_28d: number;
  views_total: number;
  returned_7d: boolean;
  active_m1: boolean;
  active_m2: boolean;
  active_m3: boolean;
  active_28d: boolean;
  active_prev28: boolean;
  active_days_28d: number;
  last_active_day: string | null;
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  ios: "App Store",
  android: "Android",
  web: "Web",
  invite: "Invitation",
};

export const METHOD_LABELS: Record<string, string> = {
  url: "URL",
  photo: "Photo",
  voice: "Voix",
  manual: "Manuel",
  shared: "Copie partagée",
  unknown: "Indéterminé",
};

export const ACTIVATION_MIN_RECIPES = 3;
export const M_LEN = 28;

const d0 = (p: Person) => p.created_at.slice(0, 10);

export function isActivated(p: Person): boolean {
  return p.recipes_7d >= ACTIVATION_MIN_RECIPES && p.returned_7d;
}

/** Jour de l'arrivée + 7 passé : l'activation est jugeable. */
export function eligibleAt7(p: Person, today: string): boolean {
  return addDays(d0(p), 7) <= today;
}

/** Fenêtre M{k} entièrement passée (k = 1..3). */
export function eligibleM(p: Person, k: 1 | 2 | 3, today: string): boolean {
  return addDays(d0(p), k * M_LEN + M_LEN - 1) < today;
}

// ---------------------------------------------------------------------------
// Acquisition
// ---------------------------------------------------------------------------

export type ChannelCounts = Record<Channel, number> & { total: number };

export function newPeople(people: Person[], w: Window): ChannelCounts {
  const out: ChannelCounts = { ios: 0, android: 0, web: 0, invite: 0, total: 0 };
  for (const p of people) {
    if (!inWindow(d0(p), w)) continue;
    out[p.channel] += 1;
    out.total += 1;
  }
  return out;
}

export type WeeklyChannels = { weekStart: string; label: string; ios: number; android: number; web: number; invite: number; total: number };

export function newPeopleWeekly(people: Person[], endSunday: string, weeks: number): WeeklyChannels[] {
  const starts = weekStarts(endSunday, weeks);
  const rows = new Map<string, WeeklyChannels>(
    starts.map((s) => [s, { weekStart: s, label: s.slice(8, 10) + "/" + s.slice(5, 7), ios: 0, android: 0, web: 0, invite: 0, total: 0 }]),
  );
  for (const p of people) {
    const r = rows.get(weekStart(d0(p)));
    if (!r) continue;
    r[p.channel] += 1;
    r.total += 1;
  }
  return [...rows.values()];
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export type ActivationFunnel = {
  arrivals: number;
  firstRecipe7d: number;
  threeRecipes7d: number;
  returned7d: number;
  activated: Ratio;
};

/** Personnes arrivées dans la fenêtre ET jugeables à J+7. */
export function activationFunnel(people: Person[], w: Window, today: string): ActivationFunnel {
  const cohort = people.filter((p) => inWindow(d0(p), w) && eligibleAt7(p, today));
  const firstRecipe7d = cohort.filter((p) => p.first_recipe_at != null && daysBetween(d0(p), p.first_recipe_at.slice(0, 10)) <= 7).length;
  const activated = cohort.filter(isActivated).length;
  return {
    arrivals: cohort.length,
    firstRecipe7d,
    threeRecipes7d: cohort.filter((p) => p.recipes_7d >= ACTIVATION_MIN_RECIPES).length,
    returned7d: cohort.filter((p) => p.returned_7d).length,
    activated: ratio(activated, cohort.length),
  };
}

export type MethodActivation = { method: string; label: string; r: Ratio };

/** Activation selon la méthode du tout premier ajout, sur les arrivées jugeables depuis `since`. */
export function activationByFirstMethod(people: Person[], since: string, today: string): MethodActivation[] {
  const cohort = people.filter((p) => d0(p) >= since && eligibleAt7(p, today));
  const by = new Map<string, { n: number; a: number }>();
  for (const p of cohort) {
    const key = p.first_method ?? "none";
    const e = by.get(key) ?? { n: 0, a: 0 };
    e.n += 1;
    if (isActivated(p)) e.a += 1;
    by.set(key, e);
  }
  return [...by.entries()]
    .map(([method, { n, a }]) => ({ method, label: method === "none" ? "Aucune recette" : (METHOD_LABELS[method] ?? method), r: ratio(a, n) }))
    .sort((x, y) => y.r.n - x.r.n || y.r.total - x.r.total);
}

export type WeeklyActivation = { weekStart: string; label: string; arrivals: number; activated: number };

export function activationWeekly(people: Person[], endSunday: string, weeks: number, today: string): WeeklyActivation[] {
  // Dernière semaine jugeable : arrivées jusqu'au dimanche d'il y a 7 jours.
  const end = addDays(endSunday, -7);
  const starts = weekStarts(end, weeks);
  const rows = new Map<string, WeeklyActivation>(starts.map((s) => [s, { weekStart: s, label: s.slice(8, 10) + "/" + s.slice(5, 7), arrivals: 0, activated: 0 }]));
  for (const p of people) {
    if (!eligibleAt7(p, today)) continue;
    const r = rows.get(weekStart(d0(p)));
    if (!r) continue;
    r.arrivals += 1;
    if (isActivated(p)) r.activated += 1;
  }
  return [...rows.values()];
}

// ---------------------------------------------------------------------------
// Rétention
// ---------------------------------------------------------------------------

export type RollingM1 = { r: Ratio; window: Window };

/**
 * Rétention M1 glissante : arrivées des 4 semaines closes il y a 8 semaines
 * (par rapport à `endSunday`), actives entre J+28 et J+55 — fenêtre toujours
 * complète.
 */
export function rollingM1(people: Person[], endSunday: string): RollingM1 {
  const window = weeksEnding(addDays(endSunday, -56), 4);
  const cohort = people.filter((p) => inWindow(d0(p), window));
  return { r: ratio(cohort.filter((p) => p.active_m1).length, cohort.length), window };
}

export type CohortCell = { r: Ratio; eligible: number; state: "done" | "partial" | "pending" | "none"; pendingFrom?: string };
export type CohortRow = { month: string; n: number; m1: CohortCell; m2: CohortCell; m3: CohortCell; activeNow: number };

function cohortCell(cohort: Person[], k: 1 | 2 | 3, today: string): CohortCell {
  const eligible = cohort.filter((p) => eligibleM(p, k, today));
  if (cohort.length === 0) return { r: ratio(0, 0), eligible: 0, state: "none" };
  if (eligible.length === 0) {
    const firstD0 = cohort.map(d0).sort()[0];
    return { r: ratio(0, 0), eligible: 0, state: "pending", pendingFrom: addDays(firstD0, k * M_LEN + M_LEN) };
  }
  const key = (`active_m${k}`) as "active_m1" | "active_m2" | "active_m3";
  const active = eligible.filter((p) => p[key]).length;
  return { r: ratio(active, eligible.length), eligible: eligible.length, state: eligible.length === cohort.length ? "done" : "partial" };
}

/** Premier mois du parc mesuré sous le modèle d'identité actuel (cutover
 *  Supabase prod le 2026-05-20) : les quelques owners antérieurs (« À Table »)
 *  n'ont pas d'activité comparable et sortent de la table de cohortes. */
export const COHORT_SINCE = "2026-05-01";

/** Table de cohortes mensuelles (depuis COHORT_SINCE), la plus récente en dernier. */
export function cohortTable(people: Person[], today: string): CohortRow[] {
  const by = new Map<string, Person[]>();
  for (const p of people) {
    if (d0(p) < COHORT_SINCE) continue;
    const m = d0(p).slice(0, 7);
    by.set(m, [...(by.get(m) ?? []), p]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cohort]) => ({
      month,
      n: cohort.length,
      m1: cohortCell(cohort, 1, today),
      m2: cohortCell(cohort, 2, today),
      m3: cohortCell(cohort, 3, today),
      activeNow: cohort.filter((p) => p.active_28d).length,
    }));
}

export type RetentionCurve = { month: string; n: number; points: (number | null)[] };

/** Courbes M0→M3 des cohortes jugeables en M1 (≥ 5 personnes). */
export function retentionCurves(rows: CohortRow[]): RetentionCurve[] {
  return rows
    .filter((r) => r.n >= 5 && r.m1.state !== "pending" && r.m1.state !== "none")
    .map((r) => ({
      month: r.month,
      n: r.n,
      points: [100, r.m1.r.pct, r.m2.state === "pending" || r.m2.state === "none" ? null : r.m2.r.pct, r.m3.state === "pending" || r.m3.state === "none" ? null : r.m3.r.pct],
    }));
}

// ---------------------------------------------------------------------------
// Engagement & listes
// ---------------------------------------------------------------------------

export type Engagement = {
  active28: number;
  engaged28: number;
  adders28: number;
  viewers28: number;
  distribution: { label: string; value: number }[];
  recipesPerActive: number;
  multiCarnet: number;
  withEmail: number;
  activeWithoutEmail: number;
  leaving: Person[];
};

export function engagement(people: Person[]): Engagement {
  const active = people.filter((p) => p.active_28d);
  const bins = [
    { label: "0", test: (n: number) => n === 0 },
    { label: "1 – 4", test: (n: number) => n >= 1 && n <= 4 },
    { label: "5 – 19", test: (n: number) => n >= 5 && n <= 19 },
    { label: "20 +", test: (n: number) => n >= 20 },
  ];
  const recipes28 = active.reduce((s, p) => s + p.recipes_28d, 0);
  return {
    active28: active.length,
    engaged28: active.filter((p) => p.recipes_28d > 0 || p.views_28d > 0).length,
    adders28: active.filter((p) => p.recipes_28d > 0).length,
    viewers28: active.filter((p) => p.views_28d > 0).length,
    distribution: bins.map((b) => ({ label: b.label, value: active.filter((p) => b.test(p.recipes_28d)).length })),
    recipesPerActive: active.length ? +(recipes28 / active.length).toFixed(1) : 0,
    multiCarnet: people.filter((p) => p.carnets > 1).length,
    withEmail: people.filter((p) => p.has_email).length,
    activeWithoutEmail: active.filter((p) => !p.has_email).length,
    leaving: people
      .filter((p) => p.active_prev28 && !p.active_28d)
      .sort((a, b) => b.recipes_total - a.recipes_total),
  };
}
