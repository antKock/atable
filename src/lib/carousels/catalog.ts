import { t } from "@/lib/i18n/fr";

// Les noms de tags doivent matcher EXACTEMENT la table `tags` (migration 004),
// espaces autour des « / » compris : « Libanaise / Orientale », pas
// « Libanaise/Orientale ».
export type CarouselPredicate =
  // Groupe A — tri algorithmique sur tout le catalogue du foyer
  | {
      type: "sort";
      by: "lastActivityAt" | "viewCount";
      dir: "asc" | "desc";
      /** Restreint aux recettes déjà ouvertes (view_count > 0). */
      onlyViewed?: boolean;
    }
  // Groupe B — catégories
  | { type: "tag"; tag: string }
  | { type: "tags"; anyOf: string[] }
  | { type: "field"; field: "cost"; equals: string };

export type CarouselDef = {
  key: string;
  title: string;
  pinned?: boolean;
  reorderable: boolean;
  predicate: CarouselPredicate;
};

function category(key: string, title: string, predicate: CarouselPredicate): CarouselDef {
  return { key, title, reorderable: true, predicate };
}

// Ajouter/retirer un carrousel = éditer cette liste, zéro logique ailleurs.
// L'éligibilité (≥ 1 recette) + les tiers + le plancher élaguent tout seuls :
// un grand catalogue est sans risque.
export const CAROUSEL_CATALOG: CarouselDef[] = [
  // --- Groupe A — algorithmiques ---
  {
    key: "recentes",
    title: t.carousels.recentes,
    pinned: true,
    reorderable: false,
    predicate: { type: "sort", by: "lastActivityAt", dir: "desc" },
  },
  {
    key: "plusVues",
    title: t.carousels.plusVues,
    reorderable: false,
    predicate: { type: "sort", by: "viewCount", dir: "desc", onlyViewed: true },
  },
  {
    key: "redecouvrir",
    title: t.carousels.redecouvrir,
    reorderable: false,
    predicate: { type: "sort", by: "lastActivityAt", dir: "asc" },
  },

  // --- Groupe B — type de plat ---
  category("apero", t.carousels.apero, { type: "tag", tag: "Apéro" }),
  category("desserts", t.carousels.desserts, { type: "tag", tag: "Dessert" }),
  category("petitDejeuner", t.carousels.petitDejeuner, { type: "tag", tag: "Petit-déjeuner" }),
  category("boissons", t.carousels.boissons, { type: "tag", tag: "Boisson" }),
  category("soupes", t.carousels.soupes, { type: "tag", tag: "Soupe" }),
  category("salades", t.carousels.salades, { type: "tag", tag: "Salade" }),
  category("gouter", t.carousels.gouter, { type: "tag", tag: "Goûter" }),

  // --- Groupe B — régime ---
  category("vegetarien", t.carousels.vegetarien, { type: "tag", tag: "Végétarien" }),
  category("comfortFood", t.carousels.comfortFood, { type: "tag", tag: "Comfort food" }),
  category("vegan", t.carousels.vegan, { type: "tag", tag: "Végan" }),
  category("leger", t.carousels.leger, { type: "tag", tag: "Léger" }),

  // --- Groupe B — protéine principale ---
  category("poulet", t.carousels.poulet, { type: "tag", tag: "Poulet" }),
  category("boeuf", t.carousels.boeuf, { type: "tag", tag: "Bœuf" }),
  category("porc", t.carousels.porc, { type: "tag", tag: "Porc" }),
  category("agneau", t.carousels.agneau, { type: "tag", tag: "Agneau" }),
  category("poisson", t.carousels.poisson, { type: "tag", tag: "Poisson" }),
  category("fruitsDeMer", t.carousels.fruitsDeMer, { type: "tag", tag: "Fruits de mer" }),
  category("oeufs", t.carousels.oeufs, { type: "tag", tag: "Œufs" }),
  category("proteinesVegetales", t.carousels.proteinesVegetales, {
    type: "tag",
    tag: "Tofu / Protéines végétales",
  }),
  category("legumineuses", t.carousels.legumineuses, { type: "tag", tag: "Légumineuses" }),

  // --- Groupe B — cuisine ---
  // Tout sauf « Française » (cuisine par défaut). Italienne repliée dans le
  // bundle : fin de l'exception « Cuisine italienne ».
  category("cuisineDuMonde", t.carousels.cuisineDuMonde, {
    type: "tags",
    anyOf: [
      "Italienne",
      "Indienne",
      "Libanaise / Orientale",
      "Mexicaine",
      "Asiatique",
      "Africaine",
      "Américaine",
      "Méditerranéenne",
      "Nordique",
    ],
  }),

  // --- Groupe B — occasion ---
  category("rapide", t.carousels.rapide, { type: "tag", tag: "Rapide" }),
  category("repasDeFete", t.carousels.repasDeFete, { type: "tag", tag: "Repas de fête" }),
  category("enBatch", t.carousels.enBatch, { type: "tag", tag: "En batch" }),
  category("lunchbox", t.carousels.lunchbox, { type: "tag", tag: "Lunchbox" }),
  category("piqueNique", t.carousels.piqueNique, { type: "tag", tag: "Pique-nique" }),

  // --- Groupe B — caractéristiques ---
  // Source unique = champ cost (le tag « Pas cher » reste inutilisé ici).
  category("pasCher", t.carousels.pasCher, { type: "field", field: "cost", equals: "€" }),
  category("pourLesEnfants", t.carousels.pourLesEnfants, { type: "tag", tag: "Pour les enfants" }),
  category("onePot", t.carousels.onePot, { type: "tag", tag: "One-pot" }),
  category("sansCuisson", t.carousels.sansCuisson, { type: "tag", tag: "Sans cuisson" }),
  category("aCongeler", t.carousels.aCongeler, { type: "tag", tag: "À congeler" }),
];
