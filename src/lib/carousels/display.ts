import type { CarouselSection } from "./types";

// Rang pseudo-aléatoire d'une section pour un seed donné (FNV-1a). Chaque clé
// a un rang indépendant des autres sections : contrairement à un Fisher-Yates,
// l'apparition d'une section en cours de polling (ex. première recette d'une
// catégorie pendant l'enrichissement) ne rebat pas l'ordre relatif des autres.
function rank(seed: number, key: string): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Récentes (pinned) en tête ; tout le reste shufflé, stable pour un seed donné. */
export function orderSections(
  sections: CarouselSection[],
  seed: number,
): CarouselSection[] {
  return [...sections].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return rank(seed, a.key) - rank(seed, b.key);
  });
}

/**
 * Nombre de cartes de tête qui comptent comme « déjà vues » d'un carrousel à
 * l'autre — soit ce qui s'affiche sans scroller (carte ~62vw). C'est la tête
 * qui crée l'impression de répétition ; alimenter le Set avec le contenu
 * COMPLET (jusqu'à 10) marquait tout le petit catalogue comme vu dès
 * « Récentes » (épinglé en tête), et défaisait la démotion en aval — les
 * catégories n'avaient plus aucune recette fraîche à faire remonter.
 */
export const SEEN_HEAD = 2;

/**
 * Passe « fraîcheur » de haut en bas sur l'ordre final, avec le Set des
 * recettes déjà affichées EN TÊTE des carrousels retenus au-dessus :
 * - tris sémantiques (non réordonnables, non épinglés) : masqués si aucune de
 *   leurs 2 premières cartes n'est fraîche — c'est la tête du carrousel qui
 *   crée l'impression de répétition sur mobile ;
 * - catégories (réordonnables) : recettes déjà vues repoussées en queue,
 *   jamais masquées (doublon résiduel accepté sur petit foyer) ;
 * - carrousel vide : toujours masqué.
 */
export function cascadeDedup(sections: CarouselSection[]): CarouselSection[] {
  const seen = new Set<string>();
  const result: CarouselSection[] = [];

  for (const section of sections) {
    if (section.recipes.length === 0) continue;

    // `shown` = ordre réellement affiché de ce carrousel (après démotion pour
    // les catégories) ; c'est lui qui alimente le Set, pas les données brutes.
    let shown = section.recipes;
    if (!section.reorderable) {
      const headIsStale = section.recipes
        .slice(0, SEEN_HEAD)
        .every((recipe) => seen.has(recipe.id));
      if (headIsStale && !section.pinned) continue;
      result.push(section);
    } else {
      const fresh = section.recipes.filter((recipe) => !seen.has(recipe.id));
      const stale = section.recipes.filter((recipe) => seen.has(recipe.id));
      shown = [...fresh, ...stale];
      result.push({ ...section, recipes: shown });
    }

    // Seule la tête (visible sans scroller) alimente le Set — cf. SEEN_HEAD.
    for (const recipe of shown.slice(0, SEEN_HEAD)) seen.add(recipe.id);
  }

  return result;
}

/**
 * Unique porte d'entrée côté client : ordre (shuffle seedé, Récentes épinglé)
 * puis dédup visuelle en cascade. Pur — le composant reste bête.
 */
export function prepareForDisplay(
  sections: CarouselSection[],
  seed: number,
): CarouselSection[] {
  return cascadeDedup(orderSections(sections, seed));
}
