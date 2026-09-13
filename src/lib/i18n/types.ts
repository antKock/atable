import type { t as fr } from "./fr";
import type { frServer } from "./fr.server";

// `fr.ts` est déclaré `as const` : ses feuilles sont des littéraux
// (`"Accueil"`). Pour qu'un autre dictionnaire puisse porter d'autres valeurs
// avec EXACTEMENT la même forme, on élargit les littéraux en `string` tout en
// conservant les signatures des fonctions (`servingsSuffix: (n) => …`). Une
// clé manquante ou en trop dans `en.ts` = erreur `tsc`.
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

/** Dictionnaire CLIENT (embarqué dans le bundle) : tout ce que l'UI affiche. */
export type Dictionary = Widen<typeof fr>;
/** Espaces de noms SERVEUR (api, validation, email, carousels) — fr.server.ts. */
export type ServerDictionary = Widen<typeof frServer>;
/** Ce que `getT()` renvoie côté serveur : client + serveur, une seule locale. */
export type FullDictionary = Dictionary & ServerDictionary;
