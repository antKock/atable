import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { withOwnerAuth, requireMember, assertNotDemoSeedMutation } from "@/lib/api/with-owner-auth";
import { householdIds } from "@/lib/auth/owner-context";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getT } from "@/lib/i18n/server";

const BUCKET = "recipe-photos";

type RouteContext = { params: Promise<{ id: string }> };

// Déplace, best-effort, un objet Storage rangé par foyer d'un chemin
// `${sourceHid}/…` vers `${destHid}/…` : copie D'ABORD (l'URL reste servable),
// renvoie la nouvelle URL publique, PUIS on supprimera la source. Les images
// « generated/… » et « copies/… » sont rangées par recette (pas par foyer) :
// elles suivent la recette sans déplacement. Retourne { url, sourcePath } quand
// un objet foyer-scopé a été copié, sinon null.
async function relocateFoyerScopedImage(
  supabase: SupabaseClient,
  imageUrl: string | null,
  sourceHid: string,
  destHid: string,
): Promise<{ url: string; sourcePath: string } | null> {
  if (!imageUrl) return null;
  const match = imageUrl.match(/recipe-photos\/([^?]+)/);
  if (!match) return null; // URL externe — référencée telle quelle
  const sourcePath = decodeURIComponent(match[1]);
  // Seuls les objets rangés SOUS le foyer source se déplacent (photo uploadée).
  if (!sourcePath.startsWith(`${sourceHid}/`)) return null;
  const destPath = `${destHid}/${sourcePath.slice(sourceHid.length + 1)}`;

  const { error } = await supabase.storage.from(BUCKET).copy(sourcePath, destPath);
  if (error) return null; // échec de copie → on garde l'URL source (best-effort)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(destPath);
  // Cache-buster : chemin déterministe, fichier caché 30 j → forcer le refetch.
  return { url: `${data.publicUrl}?v=${Date.now()}`, sourcePath };
}

// PATCH /api/recipes/[id]/move { householdId }
// Déplace une recette d'un foyer vers un autre (maquette 2.4, Lot 4). MEMBRE
// requis sur la SOURCE et la DESTINATION (jamais vers un foyer invité). Les tags
// (recipe_tags) sont rattachés à la recette, pas au foyer → ils suivent.
export const PATCH = withOwnerAuth(
  async (request: NextRequest, { params }: RouteContext, owner) => {
    const t = await getT();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const destHid = typeof body?.householdId === "string" ? body.householdId : "";
    if (!destHid) {
      return NextResponse.json({ error: t.api.targetHouseholdMissing }, { status: 422 });
    }

    const supabase = createServerClient();

    // La recette doit exister dans un foyer de l'owner ; on lit son foyer source.
    const { data: recipe } = await supabase
      .from("recipes")
      .select("id, household_id, photo_url, is_seed")
      .eq("id", id)
      .in("household_id", householdIds(owner))
      .single();

    if (!recipe) {
      return NextResponse.json({ error: t.api.recipeNotFound }, { status: 404 });
    }
    const sourceHid = recipe.household_id as string;
    const frozen = await assertNotDemoSeedMutation(owner, { household_id: sourceHid, is_seed: recipe.is_seed });
    if (frozen) return frozen;

    // MEMBRE sur la source (déplacer = écriture) ET sur la destination (on
    // n'écrit jamais dans un foyer invité). requireMember couvre les deux.
    const sourceForbidden = requireMember(owner, sourceHid);
    if (sourceForbidden) return sourceForbidden;
    const destForbidden = requireMember(owner, destHid);
    if (destForbidden) return destForbidden;

    if (destHid === sourceHid) {
      // No-op explicite : déjà dans ce foyer.
      return NextResponse.json({ ok: true, householdId: sourceHid });
    }

    // 1) Copier l'image foyer-scopée vers le chemin du foyer cible (best-effort).
    const relocated = await relocateFoyerScopedImage(
      supabase,
      recipe.photo_url,
      sourceHid,
      destHid,
    );

    // 2) Mettre à jour la recette (foyer + éventuelle nouvelle URL de photo).
    // last_moved_at : trace du déplacement pour le dashboard (032) — seul le
    // dernier déplacement est conservé, suffisant pour un compteur macro. Même
    // timestamp que updated_at : un déplacement EST la dernière modification.
    const movedAt = new Date().toISOString();
    const update: Record<string, unknown> = {
      household_id: destHid,
      updated_at: movedAt,
      last_moved_at: movedAt,
    };
    if (relocated) update.photo_url = relocated.url;

    const { error: updateError } = await supabase
      .from("recipes")
      .update(update)
      .eq("id", id)
      .eq("household_id", sourceHid);

    if (updateError) throw updateError;

    // 3) Supprimer l'objet source SEULEMENT après le succès du update (jamais
    //    l'inverse : une image orpheline vaut mieux qu'une recette sans image).
    if (relocated) {
      await supabase.storage.from(BUCKET).remove([relocated.sourcePath]);
    }

    revalidatePath("/home");
    revalidatePath("/library");
    revalidatePath("/recipes/[id]", "page");

    return NextResponse.json({ ok: true, householdId: destHid });
  },
);
