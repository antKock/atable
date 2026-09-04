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

/**
 * Langue préférée d'après `Accept-Language` : la première entrée par poids `q`
 * décroissant (ordre d'apparition à poids égal, comme les navigateurs).
 * `fr*` → fr, tout le reste → en. Header absent/vide → défaut fr.
 */
export function parseAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const entries = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((e) => e.tag && e.tag !== "*" && e.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  const first = entries[0];
  if (!first) return DEFAULT_LOCALE;
  return first.tag === "fr" || first.tag.startsWith("fr-") ? "fr" : "en";
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

export function readI18nFlags(env: NodeJS.ProcessEnv = process.env) {
  return {
    enEnabled: env.I18N_EN_ENABLED === "1",
    previewEnabled: env.I18N_PREVIEW_COOKIE === "1",
  };
}

/** Locale BCP 47 complète (OG `locale`, `Intl`). */
export const LOCALE_TAGS: Record<Locale, string> = { fr: "fr-FR", en: "en-US" };
