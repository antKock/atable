import type { SupabaseClient } from "@supabase/supabase-js";
import { isDemoOwner } from "@/lib/api/with-owner-auth";
import type { OwnerContext } from "@/lib/auth/owner-context";
import { parseAcquisition, type Acquisition } from "@/lib/acquisition";

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

/**
 * Attribution héritée à la conversion (migration 034) : si l'owner courant est
 * démo, sa session porte peut-être l'acquisition captée sur la landing — on la
 * recopie sur le carnet créé. Couvre la conversion depuis n'importe quelle
 * page de l'app (le localStorage du client n'est relu que sur la landing).
 */
export async function resolveDemoAcquisition(
  supabase: SupabaseClient,
  existingOwner: OwnerContext | null,
): Promise<Acquisition | null> {
  if (!existingOwner || !isDemoOwner(existingOwner)) return null;
  const { data } = await supabase
    .from("device_sessions")
    .select("acquisition")
    .eq("owner_id", existingOwner.ownerId)
    .order("created_at", { ascending: true })
    .limit(1);
  return parseAcquisition(data?.[0]?.acquisition);
}
