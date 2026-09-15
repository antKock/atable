import type { DbClient } from "@/lib/supabase/server";

// Aperçu du carnet sur l'écran d'invitation (/join/[code]) : quelques vignettes
// de recettes et le total, pour que la personne invitée voie ce qu'elle rejoint
// au lieu d'un nom seul. Jamais bloquant — une lecture en échec rend `null` et
// l'écran retombe sur la cocotte (cf. page.tsx).

/** Vignette prête à afficher ; `imageUrl` null = dégradé déterministe + titre. */
export type JoinThumbnail = { id: string; title: string; imageUrl: string | null };

export type JoinPreview = {
  /** Total des recettes du carnet, pour la ligne de contexte. */
  count: number;
  thumbnails: JoinThumbnail[];
};

/** Vignettes du héros : au-delà de 3, l'éventail ne tient plus dans la largeur. */
export const JOIN_THUMBNAILS = 3;
/** Recettes lues : de quoi trouver 3 illustrations parmi les plus récentes. */
const CANDIDATES = 12;

/**
 * Choisit les vignettes parmi les recettes RÉCENTES (l'ordre d'entrée fait foi) :
 * celles qui portent une image d'abord, les autres ensuite. Un carnet dont les
 * trois dernières recettes attendent encore leur illustration (~20 s après
 * l'ajout) montre ainsi de vraies photos plus anciennes plutôt que trois aplats.
 */
export function pickJoinThumbnails(
  recipes: JoinThumbnail[],
  max: number = JOIN_THUMBNAILS,
): JoinThumbnail[] {
  const withImage = recipes.filter((r) => r.imageUrl !== null);
  const withoutImage = recipes.filter((r) => r.imageUrl === null);
  return [...withImage, ...withoutImage].slice(0, max);
}

/**
 * Compte + vignettes d'un foyer. Les erreurs ne sont PAS propagées : l'aperçu
 * est décoratif, il ne doit jamais empêcher de rejoindre un carnet.
 */
export async function loadJoinPreview(
  db: DbClient,
  householdId: string,
): Promise<JoinPreview | null> {
  const [total, recent] = await Promise.all([
    db
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("is_seed", false),
    db
      .from("recipes")
      .select("id, title, photo_url, generated_image_url")
      .eq("household_id", householdId)
      .eq("is_seed", false)
      .order("created_at", { ascending: false })
      .limit(CANDIDATES),
  ]);

  if (total.error || recent.error) return null;

  const thumbnails = pickJoinThumbnails(
    (recent.data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      // Photo prise par un membre d'abord, illustration générée ensuite —
      // même ordre de préférence que RecipeCard.
      imageUrl: r.photo_url ?? r.generated_image_url,
    })),
  );

  return { count: total.count ?? 0, thumbnails };
}
