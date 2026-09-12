// Registre des « dates de naissance » des métriques du dashboard — la source
// de vérité unique des limites de mesure affichées dans le panneau
// « Définitions & limites » (stats v3) et des repères produit sur les graphes.
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
  /** Stats App Store (042, backlog #19) : premier jour couvert par le flux
   *  Analytics ONGOING créé le 2026-08-16 (instances DAILY à partir du 17/08,
   *  données de J-1). Aucune donnée quotidienne avant. */
  appStoreDaily: "2026-08-16",
} as const;

/** Événements produit posés en repère sur les graphes (pas des changements de mesure). */
export const PRODUCT_EVENTS = {
  /** iOS 1.3 en ligne : fiche App Store refondue (titre « Livre de recettes », visuels, EN). */
  appStoreListingV2: "2026-09-06",
} as const;
