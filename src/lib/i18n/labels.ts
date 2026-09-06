import type { Dictionary } from "./types";

// Libellés d'affichage des valeurs STOCKÉES (jamais traduites en base) :
// coût « € / €€ / €€€ », temps de cuisson « Aucune ». Les autres valeurs
// (« 30 min », « 1h - 2h »…) sont lisibles telles quelles dans les deux langues.
const COST_KEYS: Record<string, keyof Dictionary["cost"]> = {
  "€": "low",
  "€€": "medium",
  "€€€": "high",
};

export function costLabel(t: Dictionary, value: string | null | undefined): string | null {
  if (!value) return null;
  const key = COST_KEYS[value];
  return key ? t.cost[key] : value;
}

export function cookTimeLabel(t: Dictionary, value: string | null | undefined): string | null {
  if (!value) return null;
  return value === "Aucune" ? t.form.cookTimeNone : value;
}

export function complexityLabel(t: Dictionary, value: string | null | undefined): string | null {
  if (!value) return null;
  const labels = t.complexity as Record<string, string>;
  return labels[value] ?? value;
}

/**
 * Libellé d'une catégorie de tag (valeur stockée `tags.category`, FR canonique) ;
 * `null` = tag sans catégorie → groupe de repli « Autres » / « Other ». Une
 * catégorie inconnue du dictionnaire s'affiche telle quelle.
 */
export function tagCategoryLabel(t: Dictionary, category: string | null | undefined): string {
  const key = category ?? "Autres";
  return (t.tagCategories as Record<string, string>)[key] ?? key;
}

/** Libellé d'un tag : traduit s'il est prédéfini, tel quel sinon (tag libre). */
export function tagLabel(t: Dictionary, name: string): string {
  return (t.tagNames as Record<string, string>)[name] ?? name;
}
