import { revalidatePath } from "next/cache";

/**
 * Invalide le cache de rendu des écrans qui listent ou affichent des recettes
 * (revue 2026-09-12 : 6 sites `revalidatePath` divergents — `/` au lieu de
 * `/home`, `/library` oublié sur POST et DELETE). Toute mutation de recette
 * (création, édition, photo, déplacement, copie, suppression) appelle ceci.
 */
export function revalidateRecipePaths(): void {
  revalidatePath("/home");
  revalidatePath("/library");
  revalidatePath("/recipes/[id]", "page");
}
