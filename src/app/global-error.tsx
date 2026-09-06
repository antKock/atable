"use client";

import { useEffect, useSyncExternalStore } from "react";
import * as Sentry from "@sentry/nextjs";
import { dictionaries } from "@/lib/i18n";
import { DEFAULT_LOCALE, localeForTag, type Locale } from "@/lib/i18n/locale";

const subscribeNoop = () => () => {};
const readNavigatorLocale = (): Locale => localeForTag(navigator.language);
const readServerLocale = (): Locale => DEFAULT_LOCALE;

// Last-resort boundary: catches errors thrown by the root layout itself,
// where app/error.tsx can't render. Replaces <html>/<body>, so styles are
// inline (globals.css may not have loaded).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Rendu HORS LocaleProvider (le layout racine a planté) : useT() donnerait
  // toujours fr. Repli sur la langue de l'appareil via navigator.language,
  // même règle que public/offline.html (fr* → fr, sinon en).
  // useSyncExternalStore : `navigator` n'existe pas côté serveur ; le snapshot
  // serveur (fr) est aussi celui de l'hydratation, puis React re-rend avec la
  // valeur client — pas de mismatch, pas de setState dans un effet.
  const locale = useSyncExternalStore(subscribeNoop, readNavigatorLocale, readServerLocale);
  const t = dictionaries[locale];

  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "32px",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#F5F1E8",
          color: "#1a1a18",
        }}
      >
        <p>{t.feedback.loadError}</p>
        <button
          onClick={reset}
          style={{
            background: "none",
            border: "none",
            color: "#6E7A38",
            textDecoration: "underline",
            textUnderlineOffset: "4px",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          {t.retry}
        </button>
      </body>
    </html>
  );
}
