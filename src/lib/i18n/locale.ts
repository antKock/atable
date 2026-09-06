// Résolution de la langue (chantier « Version EN », socle) — module PUR, sans
// dépendance Next : testable en vitest, importable côté client comme serveur.
//
// Décision actée (2026-09-04) : la langue suit l'appareil. Pas de préférence
// stockée, pas de sélecteur in-app. Voir docs/specs/i18n/00-socle.md.

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

// Cookie de PRÉVISUALISATION uniquement (staging/dev, Playwright) : honoré
// seulement si I18N_PREVIEW_COOKIE=1. Ce n'est PAS une préférence utilisateur.
export const LOCALE_PREVIEW_COOKIE = "mijote_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// `fr`, `fr-FR`, `fr-CA`, `FR_fr` (underscore : locales POSIX / Android,
// certains WebViews) → français. Tout autre tag → anglais.
const FRENCH_TAG = /^fr([-_]|$)/i;

/**
 * Locale d'un seul tag de langue (`navigator.language`, entrée d'Accept-Language) :
 * `fr*` → fr, tout le reste → en. Tag absent/vide → défaut fr.
 */
export function localeForTag(tag: string | null | undefined): Locale {
  if (!tag) return DEFAULT_LOCALE;
  return FRENCH_TAG.test(tag.trim()) ? "fr" : "en";
}

/**
 * Langue préférée d'après `Accept-Language` : la première entrée par poids `q`
 * décroissant (ordre d'apparition à poids égal, comme les navigateurs).
 * `fr*` → fr, tout le reste → en. Header absent/vide → défaut fr.
 *
 * Tolérances : `q=` insensible à la casse et aux espaces (`fr ; Q=0.9`). Une
 * valeur de `q` invalide (`q=abc`) rend l'entrée ignorée — la RFC 9110 ne
 * définit pas de comportement, ignorer l'entrée malformée est le choix le plus
 * sûr (les autres entrées restent prises en compte). Le joker `*` est ignoré.
 */
export function parseAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const entries = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim().toLowerCase())
        .find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((e) => e.tag && e.tag !== "*" && e.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  const first = entries[0];
  if (!first) return DEFAULT_LOCALE;
  return localeForTag(first.tag);
}

export type ResolveLocaleInput = {
  /** Valeur du cookie `mijote_locale`, s'il existe. */
  previewCookie?: string | null;
  acceptLanguage?: string | null;
  /** I18N_EN_ENABLED=1 — interrupteur de mise en service (prod : fin du Lot 4). */
  enEnabled: boolean;
  /** I18N_PREVIEW_COOKIE=1 — honore le cookie de prévisualisation (staging/dev). */
  previewEnabled: boolean;
};

export function resolveLocale(input: ResolveLocaleInput): Locale {
  if (input.previewEnabled && isLocale(input.previewCookie)) return input.previewCookie;
  if (input.enEnabled) return parseAcceptLanguage(input.acceptLanguage);
  return DEFAULT_LOCALE;
}

// Interrupteur d'environnement : `1` ou `true` (casse et espaces ignorés —
// une valeur `true` saisie dans l'UI d'un hébergeur ne doit pas éteindre
// l'anglais en silence). Tout le reste (`0`, vide, absent) = éteint.
function flagOn(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true";
}

// Forme minimale de `process.env` (index signature) : testable avec un objet nu.
export type I18nFlagsEnv = { [key: string]: string | undefined };

export function readI18nFlags(env: I18nFlagsEnv = process.env) {
  return {
    enEnabled: flagOn(env.I18N_EN_ENABLED),
    previewEnabled: flagOn(env.I18N_PREVIEW_COOKIE),
  };
}

/** Locale BCP 47 complète (OG `locale`, `Intl`). */
export const LOCALE_TAGS: Record<Locale, string> = { fr: "fr-FR", en: "en-US" };

/** Forme Open Graph de la locale (`fr_FR`, `en_US`) : underscore, pas tiret. */
export function ogLocaleTag(locale: Locale): string {
  return LOCALE_TAGS[locale].replace("-", "_");
}
