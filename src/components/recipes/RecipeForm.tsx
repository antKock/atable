"use client";

import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n/fr";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import { maybeRequestReview } from "@/lib/review";
import { notifyShareExtensionDone } from "@/lib/share-extension";
import PhotoManager from "./PhotoManager";
import TagInput from "./TagInput";
import ChipSelector from "./ChipSelector";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import HouseholdPickerDialog from "@/components/household/HouseholdPickerDialog";
import type { Recipe, Tag } from "@/types/recipe";
import type { RecipeSource } from "@/lib/schemas/recipe";

/** Foyer membre proposé au choix à l'enregistrement (multi-foyer, Lot 4). */
export type MemberFoyer = { id: string; name: string; recipeCount: number };

const PREP_TIME_OPTIONS = ["< 10 min", "10-20 min", "20-30 min", "30-45 min", "> 45 min"];
const COOK_TIME_OPTIONS = ["Aucune", "< 15 min", "15-30 min", "30 min - 1h", "1h - 2h", "> 2h"];
const COST_OPTIONS = [
  { value: "€", label: "€" },
  { value: "€€", label: "€€" },
  { value: "€€€", label: "€€€" },
];
const COMPLEXITY_OPTIONS = ["facile", "moyen", "difficile"];
const SEASON_OPTIONS = [
  { value: "printemps", label: "Printemps" },
  { value: "ete", label: "Été" },
  { value: "automne", label: "Automne" },
  { value: "hiver", label: "Hiver" },
];

// Bornes alignées sur le CHECK de la colonne servings (migration 022). Champ
// vide par défaut : le premier clic sur +/− démarre à 2 (spec #12).
const SERVINGS_MIN = 1;
const SERVINGS_MAX = 20;
const SERVINGS_FIRST_CLICK = 2;

interface CreateProps {
  mode: "create";
  initialData?: Partial<Pick<Recipe, "title" | "ingredients" | "steps" | "notes" | "prepTime" | "cookTime" | "cost" | "complexity" | "seasons" | "servings">> | null;
  recipeId?: never;
  /** How the form was reached — recorded for the add-method analytics. */
  source?: RecipeSource;
  stickySubmit?: boolean;
  /** When true, the form runs inside the iOS Share Extension's WebView: on save
   *  we dismiss the extension sheet instead of navigating. */
  shareExtension?: boolean;
  /** Foyers membres de l'owner. À l'enregistrement, si >1 → dialog de choix du
   *  foyer avant le POST ; sinon POST direct (mono-foyer, aucun dialog). */
  memberFoyers?: MemberFoyer[];
}

interface EditProps {
  mode: "edit";
  initialData: Pick<Recipe, "title" | "ingredients" | "steps" | "notes" | "tags" | "photoUrl" | "prepTime" | "cookTime" | "cost" | "complexity" | "seasons" | "servings" | "generatedImageUrl">;
  recipeId: string;
  source?: never;
  stickySubmit?: boolean;
  shareExtension?: never;
  memberFoyers?: never;
}

type RecipeFormProps = CreateProps | EditProps;

// ---------------------------------------------------------------------------
// Form state — one reducer instead of 13 useState hooks. The photo actions
// encode the coupled invariants (replacing a photo cancels removal and
// regeneration, etc.) in one place instead of in scattered callbacks.
// ---------------------------------------------------------------------------

type FormState = {
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

type FormAction =
  | { type: "setText"; field: "title" | "ingredients" | "steps" | "notes"; value: string }
  | { type: "setMetadata"; field: "prepTime" | "cookTime" | "cost" | "complexity"; value: string | null }
  | { type: "setSeasons"; seasons: string[] }
  | { type: "setServings"; value: number | null }
  | { type: "addTag"; tag: Tag }
  | { type: "removeTag"; tagId: string }
  | { type: "replacePhoto"; file: File }
  | { type: "removePhoto" }
  | { type: "requestRegenerate" }
  | { type: "saveStarted" }
  | { type: "saveFailed" };

function formReducer(state: FormState, action: FormAction): FormState {
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

function initFormState({ initialData, isEdit }: {
  initialData: RecipeFormProps["initialData"];
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

function ActLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-4 mt-2">
      <div
        style={{
          fontFamily: "var(--font-fraunces)",
          fontVariationSettings: '"opsz" 144',
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: 18,
          color: "var(--accent)",
          letterSpacing: "-0.005em",
        }}
      >
        {children}
      </div>
      {hint && (
        <p className="mt-0.5 text-xs italic text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function FieldLabel({
  children,
  required,
  optional,
  hint,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  htmlFor?: string;
}) {
  const inner = (
    <>
      {children}
      {required && (
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          requis
        </span>
      )}
      {optional && (
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          optionnel
        </span>
      )}
    </>
  );
  const className = `${hint ? "mb-0.5" : "mb-2"} block text-sm font-medium text-foreground`;
  // Render <label> only when bound to a real form control; otherwise <div>
  // to avoid orphan <label> elements above ChipSelector groups (which expose
  // their own role="group" + aria-label).
  return (
    <>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={className}>{inner}</label>
      ) : (
        <div className={className}>{inner}</div>
      )}
      {hint && (
        <p className="mb-2 text-xs italic text-muted-foreground">{hint}</p>
      )}
    </>
  );
}

// Qualificateur des ingrédients (spec #12) : saisi juste au-dessus du textarea
// des ingrédients, affiché en lecture dans le titre de la section Ingrédients.
function ServingsStepper({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const clamp = (v: number) => Math.min(SERVINGS_MAX, Math.max(SERVINGS_MIN, v));
  const step = (delta: number) =>
    onChange(value === null ? SERVINGS_FIRST_CLICK : clamp(value + delta));

  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">
        {t.form.servingsQuestion}
      </span>
      <div className="flex items-center overflow-hidden rounded-[10px] border border-input bg-surface">
        <button
          type="button"
          aria-label={t.form.servingsDecrease}
          disabled={value !== null && value <= SERVINGS_MIN}
          onClick={() => step(-1)}
          className="flex h-10 w-10 items-center justify-center text-xl font-medium text-accent transition-colors active:bg-accent/10 disabled:text-border"
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={t.form.servingsInput}
          value={value === null ? "" : String(value)}
          placeholder="—"
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            onChange(digits === "" ? null : clamp(parseInt(digits, 10)));
          }}
          className="h-10 w-11 border-x border-input bg-transparent text-center text-base font-medium text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        <button
          type="button"
          aria-label={t.form.servingsIncrease}
          disabled={value !== null && value >= SERVINGS_MAX}
          onClick={() => step(1)}
          className="flex h-10 w-10 items-center justify-center text-xl font-medium text-accent transition-colors active:bg-accent/10 disabled:text-border"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function RecipeForm({ mode, initialData, recipeId, source, stickySubmit, shareExtension, memberFoyers = [] }: RecipeFormProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const isEdit = mode === "edit";
  const { uploadPhoto } = usePhotoUpload();

  const [form, dispatch] = useReducer(formReducer, { initialData, isEdit }, initFormState);
  // Dialog de choix de foyer à l'enregistrement (multi-foyer, Lot 4).
  const [pickerOpen, setPickerOpen] = useState(false);

  const canSave = form.title.trim().length > 0;

  // Enregistrement : en création multi-foyer, on choisit le foyer AVANT le POST
  // (dialog) ; en mono-foyer ou édition, envoi direct.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || form.isSaving) return;
    if (!isEdit && memberFoyers.length > 1) {
      setPickerOpen(true);
      return;
    }
    void runSave(isEdit ? undefined : memberFoyers[0]?.id);
  }

  async function runSave(chosenHouseholdId?: string) {
    dispatch({ type: "saveStarted" });
    try {
      const payload: Record<string, unknown> = {
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

      if (isEdit) {
        if (form.photoRemoved) {
          payload.photoUrl = null;
        }
        if (form.regenerateRequested) {
          payload.regenerateImage = true;
        }

        const response = await fetch(`/api/recipes/${recipeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? t.feedback.updateError);
        }

        toast.success(t.feedback.recipeUpdated, { duration: 2500 });
        mutate("/api/carousels");
        mutate("/api/library");
        router.push(`/recipes/${recipeId}`);

        if (form.photoFile) {
          uploadPhoto(form.photoFile, recipeId).then((result) => {
            if ("error" in result) {
              toast.error(t.feedback.photoError, { duration: Infinity });
            }
          });
        }
      } else {
        payload.source = source ?? "manual";
        // Foyer de destination explicite (dialog de choix) ; absent en
        // mono-foyer → le serveur retombe sur l'unique foyer membre.
        if (chosenHouseholdId) {
          payload.householdId = chosenHouseholdId;
        }
        // Tell the server a user photo is coming so enrichment skips (and
        // doesn't bill) an AI image that the upload would immediately hide.
        if (form.photoFile) {
          payload.willUploadPhoto = true;
        }

        const response = await fetch("/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? t.feedback.saveError);
        }

        const created = await response.json();
        toast.success(t.feedback.recipeSaved, { duration: 2500 });
        mutate("/api/carousels");
        mutate("/api/library");
        // Ask for an App Store rating once they've added their 3rd recipe
        // (native-only, once ever).
        void maybeRequestReview();
        if (shareExtension) {
          // Inside the iOS Share Extension: dismiss its sheet instead of
          // navigating (the WebView is about to be torn down).
          notifyShareExtensionDone();
        } else {
          // replace: keep /recipes/new?view=form out of the back stack so
          // back-from-home lands on the chooser, not a stale form.
          router.replace("/home");
        }

        if (form.photoFile) {
          uploadPhoto(form.photoFile, created.id).then((result) => {
            if ("error" in result) {
              toast.error(t.feedback.photoError, { duration: Infinity });
              // Image generation was skipped in anticipation of this photo;
              // since it failed, fall back to generating an AI image so the
              // recipe isn't left imageless.
              void fetch(`/api/recipes/${created.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: payload.title,
                  ingredients: payload.ingredients,
                  steps: payload.steps,
                  regenerateImage: true,
                }),
              });
            }
          });
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : isEdit
            ? t.feedback.updateError
            : t.feedback.saveError,
        { duration: Infinity }
      );
      dispatch({ type: "saveFailed" });
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col">
      {/* ===== ACT 1 — L'essentiel ===== */}
      <ActLabel>L&apos;essentiel</ActLabel>

      {/* Title */}
      <div className="mb-6">
        <FieldLabel htmlFor="title" required>
          {t.form.titleLabel}
        </FieldLabel>
        <Input
          id="title"
          type="text"
          value={form.title}
          onChange={(e) => dispatch({ type: "setText", field: "title", value: e.target.value })}
          placeholder={t.form.titlePlaceholder}
          autoFocus={!isEdit}
          autoComplete="off"
          className="h-12 text-base"
        />
      </div>

      {/* Ingredients */}
      <div className="mb-6">
        <FieldLabel htmlFor="ingredients" optional hint={t.form.ingredientsHint}>
          {t.form.ingredientsLabel}
        </FieldLabel>
        <ServingsStepper
          value={form.servings}
          onChange={(value) => dispatch({ type: "setServings", value })}
        />
        <Textarea
          id="ingredients"
          value={form.ingredients}
          onChange={(e) => dispatch({ type: "setText", field: "ingredients", value: e.target.value })}
          placeholder={t.form.ingredientsPlaceholder}
          rows={4}
          className="resize-none text-base"
        />
      </div>

      {/* Steps */}
      <div className="mb-6">
        <FieldLabel htmlFor="steps" optional hint={t.form.stepsHint}>
          {t.form.stepsLabel}
        </FieldLabel>
        <Textarea
          id="steps"
          value={form.steps}
          onChange={(e) => dispatch({ type: "setText", field: "steps", value: e.target.value })}
          placeholder={t.form.stepsPlaceholder}
          rows={5}
          className="resize-none text-base"
        />
      </div>

      {/* Notes — free text, displayed exactly as typed (spec #13) */}
      <div className="mb-6">
        <FieldLabel htmlFor="notes" optional hint={t.form.notesHint}>
          {t.form.notesLabel}
        </FieldLabel>
        <Textarea
          id="notes"
          value={form.notes}
          onChange={(e) => dispatch({ type: "setText", field: "notes", value: e.target.value })}
          placeholder={t.form.notesPlaceholder}
          rows={3}
          className="resize-none text-base"
        />
      </div>

      {/* ===== ACT 2 — Les détails ===== */}
      <ActLabel hint="Mijote complète si tu laisses vide">Les détails</ActLabel>

      {/* Photo — hidden inside the Share Extension: its WebView is torn down on
          save (postMessage "done"), which would kill an in-flight photo upload.
          The photo can be added later in-app; enrichment generates an AI image. */}
      {!shareExtension && (
        <div className="mb-6">
          <PhotoManager
            currentPhotoUrl={isEdit && !form.photoRemoved ? initialData.photoUrl : null}
            currentGeneratedUrl={isEdit && !form.photoRemoved ? initialData.generatedImageUrl : null}
            previewFile={form.photoFile}
            regenerateRequested={form.regenerateRequested}
            onRegenerate={() => dispatch({ type: "requestRegenerate" })}
            onReplace={(file) => dispatch({ type: "replacePhoto", file })}
            onRemove={() => dispatch({ type: "removePhoto" })}
          />
        </div>
      )}

      {/* Prep time */}
      <div className="mb-6">
        <FieldLabel>{t.metadata.prepTime}</FieldLabel>
        <ChipSelector
          options={PREP_TIME_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
          selected={form.prepTime ?? ""}
          onChange={(v) => dispatch({ type: "setMetadata", field: "prepTime", value: (v as string) || null })}
          mode="single"
          label={t.metadata.prepTime}
        />
      </div>

      {/* Cook time */}
      <div className="mb-6">
        <FieldLabel>{t.metadata.cookTime}</FieldLabel>
        <ChipSelector
          options={COOK_TIME_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
          selected={form.cookTime ?? ""}
          onChange={(v) => dispatch({ type: "setMetadata", field: "cookTime", value: (v as string) || null })}
          mode="single"
          label={t.metadata.cookTime}
        />
      </div>

      {/* Cost */}
      <div className="mb-6">
        <FieldLabel>{t.metadata.cost}</FieldLabel>
        <ChipSelector
          options={COST_OPTIONS}
          selected={form.cost ?? ""}
          onChange={(v) => dispatch({ type: "setMetadata", field: "cost", value: (v as string) || null })}
          mode="single"
          label={t.metadata.cost}
        />
      </div>

      {/* Complexity */}
      <div className="mb-6">
        <FieldLabel>{t.metadata.complexity}</FieldLabel>
        <ChipSelector
          options={COMPLEXITY_OPTIONS.map((opt) => ({
            value: opt,
            label: t.complexity[opt as keyof typeof t.complexity],
          }))}
          selected={form.complexity ?? ""}
          onChange={(v) => dispatch({ type: "setMetadata", field: "complexity", value: (v as string) || null })}
          mode="single"
          label={t.metadata.complexity}
        />
      </div>

      {/* Tags */}
      <div className="mb-6">
        <FieldLabel optional>{t.form.tagsLabel}</FieldLabel>
        <TagInput
          selectedTags={form.selectedTags}
          onAdd={(tag) => dispatch({ type: "addTag", tag })}
          onRemove={(tagId) => dispatch({ type: "removeTag", tagId })}
        />
      </div>

      {/* Seasons */}
      <div className="mb-6">
        <FieldLabel>{t.metadata.seasons}</FieldLabel>
        <ChipSelector
          options={SEASON_OPTIONS}
          selected={form.seasons}
          onChange={(v) => dispatch({ type: "setSeasons", seasons: v as string[] })}
          mode="multi"
          label={t.metadata.seasons}
        />
      </div>

      {/* Submit */}
      <div
        className={stickySubmit ? "sticky bottom-0 -mx-4 px-4 pt-3" : undefined}
        style={
          stickySubmit
            ? {
                paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
                background:
                  "linear-gradient(to bottom, transparent, var(--background) 18px, var(--background))",
              }
            : undefined
        }
      >
        <Button
          type="submit"
          size="lg"
          disabled={!canSave || form.isSaving}
          className="h-[50px] w-full min-h-11 rounded-xl"
        >
          {t.actions.save}
        </Button>
      </div>

      {/* Delete (edit mode only) */}
      {isEdit && (
        <div
          className="mt-6 text-center"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <ConfirmDeleteDialog
            recipeId={recipeId}
            triggerLabel={t.deleteDialog.trigger}
          />
        </div>
      )}

      {/* Choix du foyer à l'enregistrement (multi-foyer) — jamais monté en
          mono-foyer (le submit poste directement). */}
      {!isEdit && memberFoyers.length > 1 && (
        <HouseholdPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title={t.household.picker.saveTitle}
          note={t.household.picker.lockNote}
          busy={form.isSaving}
          foyers={memberFoyers.map((f) => ({
            id: f.id,
            name: f.name,
            recipeCount: f.recipeCount,
          }))}
          onSelect={(id) => {
            setPickerOpen(false);
            void runSave(id);
          }}
        />
      )}
    </form>
  );
}
