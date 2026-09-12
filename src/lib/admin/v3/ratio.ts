// Ratios « % et effectif, toujours les deux » (spec stats v3, §4.3).
// Sous N < 20 le % est fragile : une personne = plusieurs points. On l'affiche
// grisé avec la marge d'erreur (demi-largeur de l'intervalle de Wilson à 95 %).

export type Ratio = {
  n: number;
  total: number;
  /** Pourcentage arrondi, null si total = 0. */
  pct: number | null;
  /** Vrai sous FRAGILE_BELOW personnes (ou total = 0). */
  fragile: boolean;
  /** ± points (Wilson 95 %), null si total = 0. */
  margin: number | null;
};

export const FRAGILE_BELOW = 20;

export function ratio(n: number, total: number): Ratio {
  if (total <= 0) return { n, total, pct: null, fragile: true, margin: null };
  const p = n / total;
  const z = 1.96;
  const denom = 1 + (z * z) / total;
  const half = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denom;
  return {
    n,
    total,
    pct: Math.round(p * 100),
    fragile: total < FRAGILE_BELOW,
    margin: Math.round(half * 100),
  };
}

/** « 22 % » ou « — » ; l'appelant ajoute n/N à côté. */
export function pctLabel(r: Ratio): string {
  return r.pct == null ? "—" : `${r.pct} %`;
}

/** « 2 / 9 ». */
export function nLabel(r: Ratio): string {
  return `${r.n.toLocaleString("fr-FR")} / ${r.total.toLocaleString("fr-FR")}`;
}

/** Variation en points entre deux ratios, null si l'un est vide. */
export function deltaPts(cur: Ratio, prev: Ratio): number | null {
  if (cur.pct == null || prev.pct == null) return null;
  return cur.pct - prev.pct;
}
