import type { t as fr } from "./fr";

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

export type Dictionary = Widen<typeof fr>;
