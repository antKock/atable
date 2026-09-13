import { t as fr } from "./fr";
import { en } from "./en";
import type { Dictionary } from "./types";
import type { Locale } from "./locale";

// Dictionnaires CLIENT (sans les espaces de noms serveur — cf. server.ts).
export const dictionaries: Record<Locale, Dictionary> = { fr, en };

export type { Dictionary, ServerDictionary, FullDictionary } from "./types";
export { LOCALES, DEFAULT_LOCALE, LOCALE_TAGS, isLocale, type Locale } from "./locale";
