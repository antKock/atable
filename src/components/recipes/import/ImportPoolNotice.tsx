"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { apiRequest } from "@/lib/api-client";

// Mention de la conservation 30 jours des envois d'import, avec le refus en un
// clic (docs/specs/ocr-appareil/01-conservation-imports.md, RGPD art. 21.4 : le
// droit d'opposition est porté explicitement à l'attention de la personne).
// Affichée sous les méthodes de l'écran d'import (avant tout envoi) et, après un
// import lancé automatiquement (extension de partage, lien profond), sur le
// formulaire pré-rempli. Le refus supprime aussi ce qui a déjà été gardé.
export default function ImportPoolNotice({ className = "" }: { className?: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function optOut() {
    if (state === "saving") return;
    setState("saving");
    try {
      await apiRequest("/api/owner/import-pool", {
        method: "PUT",
        body: { optOut: true },
        fallbackError: t.import.pool.error,
      });
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className={`text-center text-xs leading-relaxed text-muted-foreground ${className}`}>
        {t.import.pool.done}
      </p>
    );
  }

  return (
    <p className={`text-center text-xs leading-relaxed text-muted-foreground ${className}`}>
      {t.import.pool.notice}{" "}
      <button
        type="button"
        data-track="import.pool_optout"
        onClick={() => void optOut()}
        disabled={state === "saving"}
        className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
      >
        {t.import.pool.optOut}
      </button>
      {state === "error" && <span className="mt-1 block text-red-600">{t.import.pool.error}</span>}
    </p>
  );
}
