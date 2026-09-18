// État du formulaire recette (création / édition) : un reducer plutôt que
// 13 useState — les actions photo encodent les invariants couplés (remplacer
// une photo annule la suppression et la régénération, etc.) en un seul endroit.
// Module pur, sans React : testable directement.

import type { Recipe, Tag } from "@/types/recipe";
import type { RecipeSource } from "@/lib/schemas/recipe";

export type RecipeFormInitialData =
  | Partial<
      Pick<
        Recipe,
        | "title"
        | "ingredients"
        | "steps"
        | "notes"
        | "prepTime"
        | "cookTime"
        | "cost"
        | "complexity"
        | "seasons"
        | "servings"
      >
    >
  | Pick<
      Recipe,
      | "title"
      | "ingredients"
      | "steps"
      | "notes"
      | "tags"
      | "photoUrl"
      | "prepTime"
      | "cookTime"
      | "cost"
      | "complexity"
      | "seasons"
      | "servings"
      | "generatedImageUrl"
    >
  | null
  | undefined;

// ---------------------------------------------------------------------------
// Form state — one reducer instead of 13 useState hooks. The photo actions
// encode the coupled invariants (replacing a photo cancels removal and
// regeneration, etc.) in one place instead of in scattered callbacks.
// ---------------------------------------------------------------------------

export type FormState = {
  title: string;
  ingredients: string;
  steps: string;
  notes: string;
  selectedTags: Tag[];
  photoFile: File | null;
  photoRemoved: boolean;
  regenerateRequested: boolean;
  isSaving: boolean;
  prepTime: string | null;
  cookTime: string | null;
  cost: string | null;
  complexity: string | null;
  seasons: string[];
  servings: number | null;
};

export type FormAction =
  | { type: "setText"; field: "title" | "ingredients" | "steps" | "notes"; value: string }
  | {
      type: "setMetadata";
      field: "prepTime" | "cookTime" | "cost" | "complexity";
      value: string | null;
    }
  | { type: "setSeasons"; seasons: string[] }
  | { type: "setServings"; value: number | null }
  | { type: "addTag"; tag: Tag }
  | { type: "removeTag"; tagId: string }
  | { type: "replacePhoto"; file: File }
  | { type: "removePhoto" }
  | { type: "requestRegenerate" }
  | { type: "saveStarted" }
  | { type: "saveFailed" };

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "setText":
      return { ...state, [action.field]: action.value };
    case "setMetadata":
      return { ...state, [action.field]: action.value };
    case "setSeasons":
      return { ...state, seasons: action.seasons };
    case "setServings":
      return { ...state, servings: action.value };
    case "addTag":
      if (state.selectedTags.some((t) => t.id === action.tag.id)) return state;
      return { ...state, selectedTags: [...state.selectedTags, action.tag] };
    case "removeTag":
      return {
        ...state,
        selectedTags: state.selectedTags.filter((t) => t.id !== action.tagId),
      };
    case "replacePhoto":
      return {
        ...state,
        photoFile: action.file,
        photoRemoved: false,
        regenerateRequested: false,
      };
    case "removePhoto":
      return {
        ...state,
        photoFile: null,
        photoRemoved: true,
        regenerateRequested: false,
      };
    case "requestRegenerate":
      return { ...state, regenerateRequested: true, photoFile: null };
    case "saveStarted":
      return { ...state, isSaving: true };
    case "saveFailed":
      return { ...state, isSaving: false };
  }
}

export function initFormState({
  initialData,
  isEdit,
}: {
  initialData: RecipeFormInitialData;
  isEdit: boolean;
}): FormState {
  return {
    title: initialData?.title ?? "",
    ingredients: initialData?.ingredients ?? "",
    steps: initialData?.steps ?? "",
    notes: initialData?.notes ?? "",
    selectedTags: isEdit && initialData && "tags" in initialData ? initialData.tags : [],
    photoFile: null,
    photoRemoved: false,
    regenerateRequested: false,
    isSaving: false,
    prepTime: initialData?.prepTime ?? null,
    cookTime: initialData?.cookTime ?? null,
    cost: initialData?.cost ?? null,
    complexity: initialData?.complexity ?? null,
    seasons: initialData?.seasons ?? [],
    servings: initialData?.servings ?? null,
  };
}

/** Corps envoyé à POST /api/recipes ou PUT /api/recipes/[id]. */
export type RecipePayload = {
  title: string;
  ingredients: string | null;
  steps: string | null;
  notes: string | null;
  tagIds: string[];
  prepTime: string | null;
  cookTime: string | null;
  cost: string | null;
  complexity: string | null;
  seasons: string[];
  servings: number | null;
  photoUrl?: null;
  regenerateImage?: true;
  source?: RecipeSource;
  householdId?: string;
  willUploadPhoto?: true;
  importSampleId?: string;
};

/**
 * Construit le corps de la requête d'enregistrement à partir de l'état du
 * formulaire (fonction pure, revue 2026-09-12).
 *  - édition : `photoUrl: null` si la photo a été retirée, `regenerateImage`
 *    si demandé ;
 *  - création : `source`, le foyer choisi (multi-foyer) et `willUploadPhoto`
 *    quand une photo suit — le serveur saute (et ne facture pas) l'image IA
 *    que l'upload cacherait aussitôt.
 */
export function buildRecipePayload(
  form: FormState,
  ctx: {
    isEdit: boolean;
    source?: RecipeSource;
    chosenHouseholdId?: string;
    /** Envoi d'import gardé dont vient la recette (src/lib/import-pool). */
    importSampleId?: string;
  },
): RecipePayload {
  const payload: RecipePayload = {
    title: form.title.trim(),
    ingredients: form.ingredients.trim() || null,
    steps: form.steps.trim() || null,
    notes: form.notes.trim() || null,
    tagIds: form.selectedTags.map((t) => t.id),
    prepTime: form.prepTime || null,
    cookTime: form.cookTime || null,
    cost: form.cost || null,
    complexity: form.complexity || null,
    seasons: form.seasons,
    servings: form.servings,
  };
  if (ctx.isEdit) {
    if (form.photoRemoved) payload.photoUrl = null;
    if (form.regenerateRequested) payload.regenerateImage = true;
  } else {
    payload.source = ctx.source ?? "manual";
    if (ctx.chosenHouseholdId) payload.householdId = ctx.chosenHouseholdId;
    if (form.photoFile) payload.willUploadPhoto = true;
    if (ctx.importSampleId) payload.importSampleId = ctx.importSampleId;
  }
  return payload;
}
