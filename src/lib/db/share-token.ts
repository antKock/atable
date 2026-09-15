import { generateShareToken } from "@/lib/auth/share-token";
import type { DbClient } from "@/lib/supabase/server";

const MAX_ATTEMPTS = 5;

/**
 * Jeton de partage d'une recette : renvoie l'existant, sinon en frappe un.
 * Idempotent, borné au foyer propriétaire. Réessaie sur la collision (très
 * improbable) de l'index unique ; sur une course perdue (jeton posé entre-temps),
 * relit et renvoie celui qui a gagné. Partagé par POST /api/recipes/[id]/share
 * et par la lecture d'un carnet par Bien (GET /api/carnets/[code]/recettes).
 */
export async function ensureShareToken(
  supabase: DbClient,
  recipeId: string,
  householdId: string,
  existing: string | null,
): Promise<string> {
  if (existing) return existing;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generateShareToken();
    const { data: updated, error: updateError } = await supabase
      .from("recipes")
      .update({ share_token: candidate, share_token_created_at: new Date().toISOString() })
      .eq("id", recipeId)
      .eq("household_id", householdId)
      .is("share_token", null)
      .select("share_token")
      .maybeSingle();

    if (!updateError && updated?.share_token) return updated.share_token;
    if (updateError && !updateError.message.includes("duplicate")) throw updateError;

    const { data: fresh } = await supabase
      .from("recipes")
      .select("share_token")
      .eq("id", recipeId)
      .single();
    if (fresh?.share_token) return fresh.share_token;
  }
  throw new Error("Failed to mint share token");
}
