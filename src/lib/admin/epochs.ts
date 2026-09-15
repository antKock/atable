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
  /** Migration 046 (A/B onboarding #25) : compteur « première ouverture de la
   *  landing depuis le shell iOS » posé par le proxy. Avant : approximé par les
   *  essais démo iOS (faux dès que le bras B existe). Flag prod allumé le 2026-09-13, compteurs du 13 remis à zéro (tests), fenêtre depuis le 14. */
  landingFirstOpen: "2026-09-14",
} as const;

/** Événements produit posés en repère sur les graphes (pas des changements de mesure). */
export const PRODUCT_EVENTS = {
  /** iOS 1.3 en ligne : fiche App Store refondue (titre « Livre de recettes », visuels, EN). */
  appStoreListingV2: "2026-09-06",
  /** A/B onboarding (#25) : début de la fenêtre de lecture du test (section
   *  Activer), 8 semaines, revue à 4.
   *  Flag allumé le 2026-09-13 (jour 1 pollué par les tests). Recalée au
   *  2026-09-16 : le dénominateur est passé aux affectations du shell iOS
   *  (migration 050), comptées seulement à partir de sa mise en prod — avant,
   *  on ne sait pas les répartir par bras. Les arrivées des 13-15/09 restent
   *  affichées en comptes « hors fenêtre ».
   *  ⚠ à recaler sur le lendemain de la promotion si elle glisse. */
  abOnboardingStart: "2026-09-16",
} as const;
