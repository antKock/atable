import { NextRequest, NextResponse } from "next/server";
import type { TablesUpdate } from "@/lib/db/types";
import { createServerClient } from "@/lib/supabase/server";
import { withOwnerAuth, requireMember } from "@/lib/api/with-owner-auth";
import { loadOwnedRecipe } from "@/lib/db/recipes";
import { revalidateRecipePaths } from "@/lib/api/revalidate";
import { getPhotoStore, photoPathFromUrl } from "@/lib/storage/photos";
import { getT } from "@/lib/i18n/server";

type RouteContext = { params: Promise<{ id: string }> };

// Déplace, best-effort, un objet Storage rangé par foyer d'un chemin
// `${sourceHid}/…` vers `${destHid}/…` : copie D'ABORD (l'URL reste servable),
// renvoie la nouvelle URL publique, PUIS on supprimera la source. Les images
// « generated/… » et « copies/… » sont rangées par recette (pas par foyer) :
// elles suivent la recette sans déplacement. Retourne { url, sourcePath } quand
// un objet foyer-scopé a été copié, sinon null.
async function relocateFoyerScopedImage(
  imageUrl: string | null,
  sourceHid: string,
  destHid: string,
): Promise<{ url: string; sourcePath: string } | null> {
  if (!imageUrl) return null;
  const sourcePath = photoPathFromUrl(imageUrl);
  if (!sourcePath) return null; // URL externe — référencée telle quelle
  // Seuls les objets rangés SOUS le foyer source se déplacent (photo uploadée).
  if (!sourcePath.startsWith(`${sourceHid}/`)) return null;
  const destPath = `${destHid}/${sourcePath.slice(sourceHid.length + 1)}`;

  const photos = getPhotoStore();
  try {
    await photos.copy(sourcePath, destPath);
  } catch {
    return null; // échec de copie → on garde l'URL source (best-effort)
  }
  // Cache-buster : chemin déterministe, fichier caché 30 j → forcer le refetch.
  return { url: `${photos.publicUrl(destPath)}?v=${Date.now()}`, sourcePath };
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

    // Recette d'un foyer de l'owner + gardes d'écriture sur la SOURCE (membre,
    // seed démo) — ordre commun 404 → membre → démo (loadOwnedRecipe).
    const loaded = await loadOwnedRecipe(supabase, id, owner, { columns: ["photo_url"], write: true });
    if (loaded instanceof NextResponse) return loaded;
    const { recipe } = loaded;
    const sourceHid = recipe.household_id;

    // MEMBRE aussi sur la destination (on n'écrit jamais dans un foyer invité).
    const destForbidden = await requireMember(owner, destHid);
    if (destForbidden) return destForbidden;

    if (destHid === sourceHid) {
      // No-op explicite : déjà dans ce foyer.
      return NextResponse.json({ ok: true, householdId: sourceHid });
    }

    // 1) Copier l'image foyer-scopée vers le chemin du foyer cible (best-effort).
    const relocated = await relocateFoyerScopedImage(recipe.photo_url,
      sourceHid,
      destHid,
    );

    // 2) Mettre à jour la recette (foyer + éventuelle nouvelle URL de photo).
    // last_moved_at : trace du déplacement pour le dashboard (032) — seul le
    // dernier déplacement est conservé, suffisant pour un compteur macro. Même
    // timestamp que updated_at : un déplacement EST la dernière modification.
    const movedAt = new Date().toISOString();
    const update: TablesUpdate<"recipes"> = {
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
      await getPhotoStore().remove([relocated.sourcePath]);
    }

    revalidateRecipePaths();

    return NextResponse.json({ ok: true, householdId: destHid });
  },
  // Opt-out garde démo : garde fine assertNotDemoSeedMutation ci-dessus. Le
  // foyer cible vient du corps, mais requireMember(destHid) borne un visiteur
  // démo à son unique foyer (déplacement = no-op).
  { allowDemoMutation: true },
);
