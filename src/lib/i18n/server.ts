import { cache } from "react";
import { cookies, headers } from "next/headers";
import { dictionaries, type Dictionary } from "./index";
import { LOCALE_PREVIEW_COOKIE, readI18nFlags, resolveLocale, type Locale } from "./locale";

/**
 * Locale de la requête courante (Server Components, layouts, route handlers).
 * Mémoïsée par requête via `cache` : layout + page + composants = une seule
 * lecture des headers. Lire `cookies()`/`headers()` rend la route dynamique —
 * tout Mijote l'est déjà (session), la landing `/` le devient : sans effet.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    previewCookie: cookieStore.get(LOCALE_PREVIEW_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
    ...readI18nFlags(),
  });
});

export async function getT(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}
