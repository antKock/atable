import type { SupabaseClient } from "@supabase/supabase-js";
import { isDemoOwner } from "@/lib/api/with-owner-auth";
import type { OwnerContext } from "@/lib/auth/owner-context";

/**
 * Marqueur de conversion démo → carnet (dashboard v2, migration 032).
 *
 * Si la session courante résout vers un owner DÉMO, la création du nouvel
 * owner (créer un carnet OU rejoindre par code) est LA conversion : on fige la
 * date de début d'essai — le created_at de l'owner démo abandonné — sur le
 * nouvel owner. C'est la seule fenêtre où le lien démo → réel est connu du
 * serveur ; conversions/jour et time-to-convert en découlent.
 *
 * Repli sur now() si la ligne démo est introuvable (time-to-convert nul mais
 * conversion comptée — préférable à un trou dans le funnel).
 */
export async function resolveDemoTrialStart(
  supabase: SupabaseClient,
  existingOwner: OwnerContext | null,
): Promise<string | null> {
  if (!existingOwner || !isDemoOwner(existingOwner)) return null;
  const { data } = await supabase
    .from("owners")
    .select("created_at")
    .eq("id", existingOwner.ownerId)
    .single();
  return data?.created_at ?? new Date().toISOString();
}
