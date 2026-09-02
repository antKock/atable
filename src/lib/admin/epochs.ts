// Registre des « dates de naissance » des métriques du dashboard — la source
// de vérité unique pour (1) clamper les fenêtres de calcul à la période
// réellement mesurée, (2) poser les repères verticaux et zones « non mesuré »
// sur les graphes, (3) calculer l'adoption sur la cohorte exposée à une
// feature plutôt que sur le parc entier.
//
// Chaque date est celle de l'arrivée EN PROD de l'instrumentation ou de la
// feature (vérifiée dans l'historique git / la base) — pas celle du code.

export const METRIC_EPOCHS = {
  /** recipes.source enregistré à la création (migration 008, PR #63). Avant : 'unknown'. */
  recipeSource: "2026-05-30",
  /** Partage de recettes /r/[token] (013) — source 'shared' possible à partir de là. */
  sharedSource: "2026-06-01",
  /** Table ai_costs (019) : aucun coût IA mesuré avant. */
  aiCosts: "2026-06-16",
  /** Correctif ping (re-ping au premier plan, PR #96) + modèle owners (027, PR #95),
   *  le même jour. Avant : jours actifs sous-capturés, « personne » ≡ session. */
  ownerGrain: "2026-07-10",
  /** Lots 1-4 du chantier foyer en prod (PR #99) : email de récupération, profil
   *  nommé, rôle invité, multi-carnet. L'adoption ne se juge que sur les
   *  personnes/carnets arrivés depuis. */
  foyerFeatures: "2026-07-11",
  /** Premier jour couvert par le rollup stats_daily (fenêtre rétro de 30 j du
   *  premier passage du cron après la 032) : essais démo comptés depuis là. */
  demoTrials: "2026-07-17",
  /** Migration 032 : marqueur de conversion démo → carnet, compteurs
   *  stats_daily (tokens, 403 gelés), recipes.last_moved_at. */
  conversionMarker: "2026-08-14",
} as const;

export type MetricEpoch = keyof typeof METRIC_EPOCHS;

const DAY_MS = 86_400_000;

/** Nombre de jours couverts par la mesure : de l'époque à aujourd'hui inclus (≥ 1). */
export function daysSinceEpoch(epoch: MetricEpoch, today: Date): number {
  const start = new Date(METRIC_EPOCHS[epoch] + "T00:00:00Z");
  return Math.max(1, Math.floor((today.getTime() - start.getTime()) / DAY_MS) + 1);
}

/**
 * Clampe une fenêtre demandée (en jours) à la période réellement mesurée.
 * `clamped` indique que la fenêtre affichée doit être étiquetée
 * « depuis le <date> » plutôt que « N j ».
 */
export function clampWindow(
  requestedDays: number,
  epoch: MetricEpoch,
  today: Date,
): { days: number; clamped: boolean } {
  const measured = daysSinceEpoch(epoch, today);
  return measured < requestedDays
    ? { days: measured, clamped: true }
    : { days: requestedDays, clamped: false };
}

/** Libellé de fenêtre honnête : « 30 j » ou « depuis le 14 août » si clampée. */
export function windowLabel(
  requestedDays: number,
  epoch: MetricEpoch,
  today: Date,
): string {
  const { clamped } = clampWindow(requestedDays, epoch, today);
  if (!clamped) return `${requestedDays} j`;
  const d = new Date(METRIC_EPOCHS[epoch] + "T00:00:00Z");
  return `depuis le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })}`;
}

/** Vrai si une fenêtre de p_days remonte avant la naissance de la métrique. */
export function windowPredatesEpoch(days: number, epoch: MetricEpoch, today: Date): boolean {
  return daysSinceEpoch(epoch, today) < days;
}
