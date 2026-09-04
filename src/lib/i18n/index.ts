import { t as fr } from "./fr";
import { en } from "./en";
import type { Dictionary } from "./types";
import type { Locale } from "./locale";

export const dictionaries: Record<Locale, Dictionary> = { fr, en };

export type { Dictionary } from "./types";
export { LOCALES, DEFAULT_LOCALE, LOCALE_TAGS, isLocale, type Locale } from "./locale";
