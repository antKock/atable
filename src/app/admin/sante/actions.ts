"use server";

import { revalidatePath } from "next/cache";
import { isAdminOwner } from "@/lib/admin/auth";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { createServerClient } from "@/lib/supabase/server";

// « Considérer comme traité » (demande Anthony, 2026-09-13, migration 049) :
// l'échec sort du voyant Pipeline, de la liste et des alertes du veilleur,
// jusqu'au prochain échec de la même recette (enrichment.ts remet la colonne
// à NULL). Réservé à l'admin (même garde que la page).
export async function acknowledgeFailure(formData: FormData): Promise<void> {
  const owner = await getOwnerContext();
  if (!owner || !isAdminOwner(owner)) throw new Error("Unauthorized");
  const recipeId = String(formData.get("recipeId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(recipeId)) throw new Error("recipeId invalide");
  const { error } = await createServerClient()
    .from("recipes")
    .update({ failure_acknowledged_at: new Date().toISOString() })
    .eq("id", recipeId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/sante");
  revalidatePath("/admin/stats");
}
