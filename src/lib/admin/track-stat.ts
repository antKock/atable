import { after } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isProbeRequest } from "@/lib/probe.server";

/**
 * Compteurs produit quotidiens (dashboard v2, migration 032) : incrément
 * atomique d'une colonne de stats_daily via la RPC stats_daily_increment.
 *
 * Comptés à l'ÉMISSION (et pas seulement au rollup nocturne) car leurs lignes
 * sources peuvent disparaître avant : les login_tokens sont purgés dès un
 * « Renvoyer », les 403 démo n'ont aucune ligne du tout.
 *
 * `after()` sort l'écriture du chemin de réponse (elle s'achève après l'envoi,
 * d'où `stopGracePeriod` au redéploiement) ; tout est best-effort — jamais d'erreur remontée pour
 * un compteur, et no-op hors contexte requête (tests unitaires).
 */
export type StatsDailyField =
  | "demo_frozen_hits"
  | "recovery_tokens_sent"
  | "recovery_tokens_used"
  | "merge_tokens_sent"
  | "merge_tokens_used"
  | "tokens_burned"
  // A/B onboarding (#25, migration 046) : affectations par bras à la pose du
  // cookie, premières ouvertures de la landing depuis le shell iOS.
  // `_ios` (migration 050) = les mêmes affectations restreintes au shell natif,
  // seul dénominateur du test : le web est fait de scanners et de visites qui
  // n'installent pas.
  | "ab_onboarding_a"
  | "ab_onboarding_b"
  | "ab_onboarding_a_ios"
  | "ab_onboarding_b_ios"
  | "landing_first_open_ios";

export function trackStat(field: StatsDailyField): void {
  try {
    // Sonde (#26) : jamais comptée. headers() est demandé ICI (contexte requête,
    // y compris en composant serveur) et attendu dans le after().
    const probe = isProbeRequest();
    after(async () => {
      try {
        if (await probe) return;
        await createServerClient().rpc("stats_daily_increment", { p_field: field });
      } catch {
        // Best-effort.
      }
    });
  } catch {
    // after() hors contexte requête (tests unitaires) — no-op.
  }
}
