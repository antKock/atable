"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { dictionaries, type Dictionary } from "./index";
import { DEFAULT_LOCALE, LOCALE_PREVIEW_COOKIE, isLocale, type Locale } from "./locale";

// Seule la locale traverse la frontière RSC : les dictionnaires contiennent
// des fonctions (non sérialisables), le client les importe lui-même. Défaut
// `fr` hors provider — couvre `global-error.tsx`, rendu sans le layout racine.
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): Dictionary {
  return dictionaries[useContext(LocaleContext)];
}

/**
 * Outil de prévisualisation (staging/dev uniquement, monté par le layout racine
 * quand I18N_PREVIEW_COOKIE=1) : `?lang=en` pose le cookie `mijote_locale` puis
 * recharge la page sans le paramètre. Cookie non-httpOnly : ce n'est pas une
 * donnée de sécurité, juste un interrupteur de test.
 */
export function LocalePreviewSwitch() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const lang = url.searchParams.get("lang");
    if (!isLocale(lang)) return;
    document.cookie = `${LOCALE_PREVIEW_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
    url.searchParams.delete("lang");
    window.location.replace(url.toString());
  }, []);
  return null;
}
