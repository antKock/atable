"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { t } from "@/lib/i18n/fr";

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
  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
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
