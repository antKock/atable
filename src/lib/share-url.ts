import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locale";

// URL de partage d'une recette (`/r/<token>`) et indice de langue pour les
// aperçus de liens (chantier « Version EN », socle § Coûts acceptés).
//
// Les bots qui génèrent les aperçus (WhatsApp, iMessage, Slack…) n'envoient
// pas `Accept-Language` : sans indice, l'aperçu d'un lien envoyé par un
// appareil anglophone sortirait en français. L'appareil ÉMETTEUR glisse donc
// sa langue dans l'URL (`?l=en`), lue UNIQUEMENT par `generateMetadata` de
// la page publique — jamais pour le rendu de la page ni pour la locale du
// lecteur, qui restent pilotés par son propre `Accept-Language`.

export const SHARE_LOCALE_PARAM = "l";

/**
 * URL publique de partage. L'indice n'est ajouté que hors locale par défaut :
 * une URL FR reste identique à celle d'avant l'indice (liens déjà envoyés,
 * pas de bruit dans les messages).
 */
export function buildShareUrl(origin: string, token: string, locale: Locale): string {
  const url = `${origin}/r/${token}`;
  return locale === DEFAULT_LOCALE ? url : `${url}?${SHARE_LOCALE_PARAM}=${locale}`;
}

/**
 * Locale portée par `?l=` (valeur brute de `searchParams`), ou `null` si
 * absente ou invalide (valeur inconnue, paramètre répété).
 */
export function shareLocaleFromSearchParam(value: string | string[] | undefined): Locale | null {
  return isLocale(value) ? value : null;
}
