import { createServerClient } from "@/lib/supabase/server";
import { enrichRecipe } from "@/lib/enrichment";

// Recettes restées `enrichment_status = 'pending'` : l'enrichissement tourne
// dans `after()` après la réponse de POST /api/recipes — si le conteneur
// redémarre (déploiement Dokploy) pendant ce travail, la recette reste
// « en cours » pour toujours (spinner côté fiche, KPI de couverture IA
// biaisé). Ce ramassage les rejoue (revue 2026-09-12, lot 6).

export const STALE_AFTER_MS = 60 * 60 * 1000; // 1 h : au-delà de tout `after()` légitime
export const STALE_BATCH_SIZE = 20; // ~20 par passage, borne le coût OpenAI d'un run

export type EnrichStaleSummary = {
  scanned: number;
  results: { id: string; status: "ok" | "error" }[];
};

/**
 * Relance `enrichRecipe` sur les recettes bloquées en `pending` depuis plus
 * de `staleAfterMs`, `batchSize` à la fois (les plus anciennes d'abord).
 * `enrichRecipe` gère ses propres échecs (statut `failed` + Sentry) : ici on
 * ne fait que compter, un run ne s'arrête pas sur une recette en erreur.
 */
export async function enrichStaleRecipes(
  now: Date = new Date(),
  { staleAfterMs = STALE_AFTER_MS, batchSize = STALE_BATCH_SIZE } = {},
): Promise<EnrichStaleSummary> {
  const supabase = createServerClient();
  const cutoff = new Date(now.getTime() - staleAfterMs).toISOString();
  const { data, error } = await supabase
    .from("recipes")
    .select("id")
    .eq("enrichment_status", "pending")
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(batchSize);
  if (error) throw new Error(`[enrich-stale] lecture impossible : ${error.message}`);

  const results: EnrichStaleSummary["results"] = [];
  for (const { id } of data ?? []) {
    try {
      await enrichRecipe(id);
      results.push({ id, status: "ok" });
    } catch (err) {
      console.error(`[enrich-stale] ${id} :`, err);
      results.push({ id, status: "error" });
    }
  }
  return { scanned: results.length, results };
}
