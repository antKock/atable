"use client";

import { useReducer, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/client";
import { useRecipeSave } from "@/components/recipes/form/useRecipeSave";
import { formReducer, initFormState } from "@/components/recipes/form/recipe-form-state";
import PhotoManager from "@/components/recipes/form/PhotoManager";
import TagInput from "@/components/recipes/form/TagInput";
import ChipSelector from "@/components/recipes/form/ChipSelector";
import ConfirmDeleteDialog from "@/components/recipes/view/ConfirmDeleteDialog";
import HouseholdPickerDialog from "@/components/household/HouseholdPickerDialog";
import type { Recipe } from "@/types/recipe";
import type { RecipeSource } from "@/lib/schemas/recipe";

/** Foyer membre proposé au choix à l'enregistrement (multi-foyer, Lot 4). */
export type MemberFoyer = { id: string; name: string; recipeCount: number };

const PREP_TIME_OPTIONS = ["< 10 min", "10-20 min", "20-30 min", "30-45 min", "> 45 min"];
const COOK_TIME_OPTIONS = ["Aucune", "< 15 min", "15-30 min", "30 min - 1h", "1h - 2h", "> 2h"];
// Valeurs stockées ; libellés résolus au rendu via t.cost (en-US : $ / $$ / $$$)
const COST_VALUES = [
  { value: "€", key: "low" },
  { value: "€€", key: "medium" },
  { value: "€€€", key: "high" },
] as const;
const COMPLEXITY_OPTIONS = ["facile", "moyen", "difficile"];
const SEASON_VALUES = ["printemps", "ete", "automne", "hiver"] as const;

// Bornes alignées sur le CHECK de la colonne servings (migration 022). Champ
// vide par défaut : le premier clic sur +/− démarre à 2 (spec #12).
const SERVINGS_MIN = 1;
const SERVINGS_MAX = 20;
const SERVINGS_FIRST_CLICK = 2;

interface CreateProps {
  mode: "create";
  initialData?: Partial<
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
  > | null;
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
  initialData: Pick<
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
  >;
  recipeId: string;
  source?: never;
  stickySubmit?: boolean;
  shareExtension?: never;
  memberFoyers?: never;
}

type RecipeFormProps = CreateProps | EditProps;

function ActLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 mt-2">
      <div
        className="display"
        style={{
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: 18,
          color: "var(--accent)",
          letterSpacing: "-0.005em",
        }}
      >
        {children}
      </div>
      {hint && <p className="mt-0.5 text-xs italic text-muted-foreground">{hint}</p>}
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
  const t = useT();
  const inner = (
    <>
      {children}
      {required && (
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t.form.required}</span>
      )}
      {optional && (
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t.form.optional}</span>
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
        <label htmlFor={htmlFor} className={className}>
          {inner}
        </label>
      ) : (
        <div className={className}>{inner}</div>
      )}
      {hint && <p className="mb-2 text-xs italic text-muted-foreground">{hint}</p>}
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
  const t = useT();
  const clamp = (v: number) => Math.min(SERVINGS_MAX, Math.max(SERVINGS_MIN, v));
  const step = (delta: number) =>
    onChange(value === null ? SERVINGS_FIRST_CLICK : clamp(value + delta));

  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">{t.form.servingsQuestion}</span>
      <div className="flex items-center overflow-hidden rounded-[10px] border border-input bg-surface">
        <button
          type="button"
          data-track="recipe.form_servings"
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
          data-track="recipe.form_servings"
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

export default function RecipeForm({
  mode,
  initialData,
  recipeId,
  source,
  stickySubmit,
  shareExtension,
  memberFoyers = [],
}: RecipeFormProps) {
  const t = useT();
  const isEdit = mode === "edit";

  const [form, dispatch] = useReducer(formReducer, { initialData, isEdit }, initFormState);
  const { save } = useRecipeSave(
    isEdit ? { mode: "edit", recipeId } : { mode: "create", source, shareExtension },
  );
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
    const ok = await save(form, chosenHouseholdId);
    if (!ok) dispatch({ type: "saveFailed" });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col">
      {/* ===== ACT 1 — L'essentiel ===== */}
      <ActLabel>{t.form.essentials}</ActLabel>

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
          onChange={(e) =>
            dispatch({ type: "setText", field: "ingredients", value: e.target.value })
          }
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
      <ActLabel hint={t.form.detailsHint}>{t.form.details}</ActLabel>

      {/* Photo — hidden inside the Share Extension: its WebView is torn down on
          save (postMessage "done"), which would kill an in-flight photo upload.
          The photo can be added later in-app; enrichment generates an AI image. */}
      {!shareExtension && (
        <div className="mb-6">
          <PhotoManager
            currentPhotoUrl={isEdit && !form.photoRemoved ? initialData.photoUrl : null}
            currentGeneratedUrl={
              isEdit && !form.photoRemoved ? initialData.generatedImageUrl : null
            }
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
          onChange={(v) =>
            dispatch({ type: "setMetadata", field: "prepTime", value: (v as string) || null })
          }
          mode="single"
          label={t.metadata.prepTime}
        />
      </div>

      {/* Cook time */}
      <div className="mb-6">
        <FieldLabel>{t.metadata.cookTime}</FieldLabel>
        <ChipSelector
          options={COOK_TIME_OPTIONS.map((opt) => ({
            value: opt,
            label: opt === "Aucune" ? t.form.cookTimeNone : opt,
          }))}
          selected={form.cookTime ?? ""}
          onChange={(v) =>
            dispatch({ type: "setMetadata", field: "cookTime", value: (v as string) || null })
          }
          mode="single"
          label={t.metadata.cookTime}
        />
      </div>

      {/* Cost */}
      <div className="mb-6">
        <FieldLabel>{t.metadata.cost}</FieldLabel>
        <ChipSelector
          options={COST_VALUES.map((opt) => ({ value: opt.value, label: t.cost[opt.key] }))}
          selected={form.cost ?? ""}
          onChange={(v) =>
            dispatch({ type: "setMetadata", field: "cost", value: (v as string) || null })
          }
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
          onChange={(v) =>
            dispatch({ type: "setMetadata", field: "complexity", value: (v as string) || null })
          }
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
          options={SEASON_VALUES.map((value) => ({ value, label: t.seasons[value] }))}
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
          data-track="recipe.save"
          data-seen=""
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
          <ConfirmDeleteDialog recipeId={recipeId} triggerLabel={t.deleteDialog.trigger} />
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
