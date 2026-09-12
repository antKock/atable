// Mijote dashboard chart palette + typography constants.
// Single source of truth for the Recharts components (which use inline styles,
// not CSS vars). Warm, harmonious chroma — do not introduce colours outside it.

export const PALETTE = {
  olive: "#6E7A38",
  oliveDeep: "#5D6A2E",
  oliveSoft: "#A8B490",
  ochre: "#C0922F",
  terracotta: "#B85C3D",
  sage: "#5E8B7A",
  clay: "#9C6B4A",
  ink: "#1A1A18",
  muted: "#6B6E68",
  faint: "#9A968C",
  grid: "#E5DED6",
  surface: "#FBF8F1",
  paper: "#F1ECDF",
  border: "#E8E0CC",
} as const;

// Rampe séquentielle olive pour les strates de cohortes (MAU par génération) —
// lightness monotone, la plus ancienne génération la plus foncée. Module
// partagé (sans "use client") : utilisée par le chart ET la légende serveur.
export const COHORT_RAMP = [
  "#39431A", "#4E5A24", "#64712F", "#7C8A47", "#93A163", "#A8B490", "#C2CBA4", "#DCE1C8",
] as const;

/** Mois d'ancrage des générations : premier mois du parc mesuré sous le modèle
 *  actuel (cutover Supabase prod le 2026-05-20, rebrand Mijote le 2026-05-23).
 *  Le snapshot de cutover peut contenir des owners antérieurs (« À Table »,
 *  début 2026) : ils tombent sur les pas clairs par le modulo ci-dessous. */
export const COHORT_EPOCH_MONTH = "2026-05";

/** Index d'une cohorte = mois écoulés depuis COHORT_EPOCH_MONTH. Accepte la clé
 *  SQL (`2026-07-01`, date_trunc('month')) ou `YYYY-MM`. */
export function cohortIndex(cohort: string): number {
  const [ey, em] = COHORT_EPOCH_MONTH.split("-").map(Number);
  const [y, m] = cohort.split("-").map(Number);
  return (y - ey) * 12 + (m - em);
}

/** Couleur d'une cohorte, ancrée sur son MOIS (pas sur sa position parmi les
 *  cohortes visibles) : une génération garde sa couleur à vie, quelle que soit
 *  la fenêtre affichée ou la disparition des plus anciennes — la plus ancienne
 *  est la plus foncée. Au-delà de la rampe on boucle (modulo) ; le passage au
 *  trimestre est prévu avant que cela ne prête à confusion.
 *  Un nombre est accepté par compatibilité (index déjà ancré sur l'époque,
 *  cf. `cohortIndex`) — préférer la clé de cohorte. */
export function cohortColor(cohort: string | number): string {
  const n = COHORT_RAMP.length;
  const index = typeof cohort === "number" ? cohort : cohortIndex(cohort);
  return COHORT_RAMP[((index % n) + n) % n];
}

// Fonts — map the design's roles onto the app's loaded next/font variables.
export const FONT = "var(--font-inter), system-ui, sans-serif";
export const MONO = "var(--font-dm-mono), ui-monospace, monospace";

// Shared Recharts axis / grid / tooltip styling.
const axisTick = {
  fontFamily: FONT,
  fontSize: 11,
  fill: PALETTE.faint,
  fontWeight: 500,
} as const;

export const axisProps = {
  tick: axisTick,
  tickLine: false,
  axisLine: { stroke: PALETTE.grid },
} as const;

export const gridProps = {
  stroke: PALETTE.grid,
  strokeDasharray: "2 5",
  vertical: false,
} as const;
