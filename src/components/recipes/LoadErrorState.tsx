"use client";

import { WifiOff } from "lucide-react";
import { t } from "@/lib/i18n/fr";

// Shown when the recipe list request itself failed (offline Capacitor launch,
// expired session, server error). Deliberately separate from the empty state:
// "you have no recipes" and "we couldn't load your recipes" must never be
// confused.
export default function LoadErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-xs px-4 text-center">
      <div className="mb-5 flex justify-center text-muted-foreground">
        <WifiOff size={44} aria-hidden="true" />
      </div>
      <p
        className="text-foreground"
        style={{
          fontFamily: "var(--font-fraunces)",
          fontVariationSettings: '"opsz" 144',
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: 22,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
        }}
      >
        {t.loadError.title}
      </p>
      <p className="mt-2 text-muted-foreground">{t.loadError.body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex min-h-11 items-center rounded-lg px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: "var(--btn-gradient)", boxShadow: "var(--btn-shadow)" }}
      >
        {t.loadError.retry}
      </button>
    </div>
  );
}
