import { cache } from "react";
import { cookies, headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { dictionaries, type Dictionary } from "./index";
import { DEFAULT_LOCALE, LOCALE_PREVIEW_COOKIE, readI18nFlags, resolveLocale, type Locale } from "./locale";

/**
 * Locale de la requête courante (Server Components, layouts, route handlers).
 * Mémoïsée par requête via `cache` : layout + page + composants = une seule
 * lecture des headers. Lire `cookies()`/`headers()` rend la route dynamique —
 * tout Mijote l'est déjà (session), la landing `/` le devient : sans effet.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    return resolveLocale({
      previewCookie: cookieStore.get(LOCALE_PREVIEW_COOKIE)?.value,
      acceptLanguage: headerStore.get("accept-language"),
      ...readI18nFlags(),
    });
  } catch (err) {
    // Les erreurs internes de Next (bailout statique `DynamicServerError`,
    // redirect/notFound…) doivent remonter telles quelles : les avaler
    // figerait la page en FR au lieu de la rendre dynamique.
    unstable_rethrow(err);
    // Hors portée de requête (handlers appelés directement en vitest, tâches
    // sans requête) : `cookies()`/`headers()` jettent → langue par défaut.
    // Attendu en test ; ailleurs on le trace pour que le repli reste visible.
    if (process.env.NODE_ENV !== "test") {
      console.warn("[i18n] getLocale() hors contexte de requête — repli sur fr", err);
    }
    return DEFAULT_LOCALE;
  }
});

export async function getT(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}
