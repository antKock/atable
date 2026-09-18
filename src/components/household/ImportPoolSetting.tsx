"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/client";
import { apiRequest } from "@/lib/api-client";

// Réglage « Aider à améliorer les imports » du profil : conservation 30 jours
// des envois d'import (docs/specs/ocr-appareil/01-conservation-imports.md).
// Désactiver = refus, qui supprime aussi ce qui a déjà été gardé ; réactiver
// reprend la conservation pour les prochains envois. Enregistré à chaque bascule.
export default function ImportPoolSetting({ initialOptedOut }: { initialOptedOut: boolean }) {
  const t = useT();
  const [enabled, setEnabled] = useState(!initialOptedOut);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (saving) return;
    const next = !enabled;
    setSaving(true);
    setEnabled(next);
    try {
      await apiRequest("/api/owner/import-pool", {
        method: "PUT",
        body: { optOut: !next },
        fallbackError: t.import.pool.error,
      });
    } catch (err) {
      setEnabled(!next);
      toast.error(err instanceof Error ? err.message : t.import.pool.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-6">
      <div className="flex items-start gap-4 border-t border-border pt-5">
        <div className="min-w-0 flex-1">
          <p id="import-pool-label" className="text-[15px] font-medium text-foreground">
            {t.profile.importPoolLabel}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {t.profile.importPoolHint}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="import-pool-label"
          data-track="household.import_pool_toggle"
          disabled={saving}
          onClick={() => void toggle()}
          className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-60 ${
            enabled ? "bg-accent" : "bg-border"
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
