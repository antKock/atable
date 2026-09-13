"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/client";
import { apiRequest } from "@/lib/api-client";
import { useInvalidateRecipeLists } from "@/lib/swr";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import { maybeRequestReview } from "@/lib/review";
import { notifyShareExtensionDone } from "@/lib/share-extension";
import type { RecipeSource } from "@/lib/schemas/recipe";
import { buildRecipePayload, type FormState } from "@/components/recipes/form/recipe-form-state";

export type RecipeSaveContext =
  | { mode: "edit"; recipeId: string }
  | {
      mode: "create";
      /** Provenance enregistrée pour les stats d'ajout. */
      source?: RecipeSource;
      /** Dans le WebView de la Share Extension iOS : on ferme la feuille au
       *  lieu de naviguer (le WebView est démonté juste après). */
      shareExtension?: boolean;
    };

/**
 * Enregistrement d'une recette (création ou édition) — le code le plus
 * fragile du formulaire (revue 2026-09-12), isolé du rendu :
 *   1. PUT/POST du corps (`buildRecipePayload`) ;
 *   2. toast + invalidation des deux listes SWR + navigation ;
 *   3. upload DIFFÉRÉ de la photo (après la navigation, pour ne pas bloquer)
 *      avec, en création, repli « régénérer l'image IA » si l'upload échoue
 *      (l'enrichissement l'avait sautée en attendant la photo).
 *
 * `save` renvoie true si la requête a réussi (le formulaire reste en
 * « sauvegarde » : on quitte l'écran), false sinon (toast émis, l'appelant
 * réactive le formulaire).
 */
export function useRecipeSave(ctx: RecipeSaveContext) {
  const t = useT();
  const router = useRouter();
  const invalidateRecipeLists = useInvalidateRecipeLists();
  const { uploadPhoto } = usePhotoUpload();

  async function save(form: FormState, chosenHouseholdId?: string): Promise<boolean> {
    const isEdit = ctx.mode === "edit";
    const fallbackError = isEdit ? t.feedback.updateError : t.feedback.saveError;
    try {
      const payload = buildRecipePayload(form, {
        isEdit,
        source: ctx.mode === "create" ? ctx.source : undefined,
        chosenHouseholdId,
      });

      if (ctx.mode === "edit") {
        await apiRequest(`/api/recipes/${ctx.recipeId}`, {
          method: "PUT",
          body: payload,
          fallbackError,
        });
        toast.success(t.feedback.recipeUpdated, { duration: 2500 });
        invalidateRecipeLists();
        router.push(`/recipes/${ctx.recipeId}`);

        if (form.photoFile) {
          void uploadPhoto(form.photoFile, ctx.recipeId).then((result) => {
            if ("error" in result) {
              toast.error(t.feedback.photoError, { duration: Infinity });
            }
          });
        }
        return true;
      }

      const created = await apiRequest<{ id?: string }>("/api/recipes", {
        body: payload,
        fallbackError,
      });
      if (!created.id) throw new Error(fallbackError);
      const createdId = created.id;
      toast.success(t.feedback.recipeSaved, { duration: 2500 });
      invalidateRecipeLists();
      // Ask for an App Store rating once they've added their 3rd recipe
      // (native-only, once ever).
      void maybeRequestReview();
      if (ctx.shareExtension) {
        // Inside the iOS Share Extension: dismiss its sheet instead of
        // navigating (the WebView is about to be torn down).
        notifyShareExtensionDone();
      } else {
        // Land on the new recipe so the user sees the result of their
        // import/save. replace: keep /recipes/new?view=form out of the back
        // stack so back-from-fiche lands on the chooser, not a stale form.
        router.replace(`/recipes/${createdId}`);
      }

      if (form.photoFile) {
        void uploadPhoto(form.photoFile, createdId).then((result) => {
          if ("error" in result) {
            toast.error(t.feedback.photoError, { duration: Infinity });
            // Image generation was skipped in anticipation of this photo;
            // since it failed, fall back to generating an AI image so the
            // recipe isn't left imageless.
            void apiRequest(`/api/recipes/${createdId}`, {
              method: "PUT",
              body: {
                title: payload.title,
                ingredients: payload.ingredients,
                steps: payload.steps,
                regenerateImage: true,
              },
              fallbackError,
            }).catch(() => {});
          }
        });
      }
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : fallbackError, { duration: Infinity });
      return false;
    }
  }

  return { save };
}
