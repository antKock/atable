"use client";

import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import CenteredState from "@/components/ui/CenteredState";
import { trackError } from "@/lib/events/client";

// Shown when the recipe list request itself failed (offline Capacitor launch,
// expired session, server error). Deliberately separate from the empty state:
// "you have no recipes" and "we couldn't load your recipes" must never be
// confused.
export default function LoadErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  // `error.shown` (#28) : un écran d'erreur sans appel API qui le trahisse
  // (SWR a échoué en amont — hors ligne, session expirée).
  useEffect(() => trackError("load"), []);
  return (
    <CenteredState
      illustration={
        <span className="text-muted-foreground">
          <WifiOff size={44} aria-hidden="true" />
        </span>
      }
      title={t.loadError.title}
      body={t.loadError.body}
      cta={{ label: t.loadError.retry, onClick: onRetry }}
      track="error.retry"
    />
  );
}
