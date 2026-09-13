import { t as fr } from "./fr";
import { en } from "./en";
import { frServer } from "./fr.server";
import { enServer } from "./en.server";
import type { FullDictionary } from "./types";
import type { Locale } from "./locale";

// Dictionnaires COMPLETS (client + espaces de noms serveur), une locale
// entière chacun — ce que `getT()` renvoie. Module serveur : jamais importé
// par le client (règle eslint no-restricted-imports, comme fr.ts).
export const frFull: FullDictionary = { ...fr, ...frServer };
export const enFull: FullDictionary = { ...en, ...enServer };
export const fullDictionaries: Record<Locale, FullDictionary> = { fr: frFull, en: enFull };
