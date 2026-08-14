import { after } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Compteurs produit quotidiens (dashboard v2, migration 032) : incrément
 * atomique d'une colonne de stats_daily via la RPC stats_daily_increment.
 *
 * Comptés à l'ÉMISSION (et pas seulement au rollup nocturne) car leurs lignes
 * sources peuvent disparaître avant : les login_tokens sont purgés dès un
 * « Renvoyer », les 403 démo n'ont aucune ligne du tout.
 *
 * `after()` sort l'écriture du chemin de réponse (et survit au retour de la
 * fonction sur Vercel) ; tout est best-effort — jamais d'erreur remontée pour
 * un compteur, et no-op hors contexte requête (tests unitaires).
 */
export type StatsDailyField =
  | "demo_frozen_hits"
  | "recovery_tokens_sent"
  | "recovery_tokens_used"
  | "merge_tokens_sent"
  | "merge_tokens_used"
  | "tokens_burned";

export function trackStat(field: StatsDailyField): void {
  try {
    after(async () => {
      try {
        await createServerClient().rpc("stats_daily_increment", { p_field: field });
      } catch {
        // Best-effort.
      }
    });
  } catch {
    // after() hors contexte requête (tests unitaires) — no-op.
  }
}
