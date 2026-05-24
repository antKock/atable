"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n/fr";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import PhotoManager from "./PhotoManager";
import TagInput from "./TagInput";
import ChipSelector from "./ChipSelector";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import type { Recipe, Tag } from "@/types/recipe";

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

interface CreateProps {
  mode: "create";
  initialData?: Partial<Pick<Recipe, "title" | "ingredients" | "steps" | "prepTime" | "cookTime" | "cost" | "complexity" | "seasons">> | null;
  recipeId?: never;
  stickySubmit?: boolean;
}

interface EditProps {
  mode: "edit";
  initialData: Pick<Recipe, "title" | "ingredients" | "steps" | "tags" | "photoUrl" | "prepTime" | "cookTime" | "cost" | "complexity" | "seasons" | "generatedImageUrl">;
  recipeId: string;
  stickySubmit?: boolean;
}

type RecipeFormProps = CreateProps | EditProps;

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
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-medium text-foreground"
    >
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
    </label>
  );
}

export default function RecipeForm({ mode, initialData, recipeId, stickySubmit }: RecipeFormProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const isEdit = mode === "edit";
  const { uploadPhoto } = usePhotoUpload();

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [ingredients, setIngredients] = useState(initialData?.ingredients ?? "");
  const [steps, setSteps] = useState(initialData?.steps ?? "");
  const [selectedTags, setSelectedTags] = useState<Tag[]>(isEdit && initialData?.tags ? initialData.tags : []);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [regenerateRequested, setRegenerateRequested] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // v3 metadata
  const [prepTime, setPrepTime] = useState<string | null>(initialData?.prepTime ?? null);
  const [cookTime, setCookTime] = useState<string | null>(initialData?.cookTime ?? null);
  const [cost, setCost] = useState<string | null>(initialData?.cost ?? null);
  const [complexity, setComplexity] = useState<string | null>(initialData?.complexity ?? null);
  const [seasons, setSeasons] = useState<string[]>(initialData?.seasons ?? []);

  const canSave = title.trim().length > 0;

  function handleAddTag(tag: Tag) {
    setSelectedTags((prev) => {
      if (prev.some((t) => t.id === tag.id)) return prev;
      return [...prev, tag];
    });
  }

  function handleRemoveTag(tagId: string) {
    setSelectedTags((prev) => prev.filter((t) => t.id !== tagId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || isSaving) return;

    setIsSaving(true);
    try {
      const tagIds = selectedTags.map((t) => t.id);

      if (isEdit) {
        const body: Record<string, unknown> = {
          title: title.trim(),
          ingredients: ingredients.trim() || null,
          steps: steps.trim() || null,
          tagIds,
          prepTime: prepTime || null,
          cookTime: cookTime || null,
          cost: cost || null,
          complexity: complexity || null,
          seasons,
        };
        if (photoRemoved) {
          body.photoUrl = null;
        }
        if (regenerateRequested) {
          body.regenerateImage = true;
        }

        const response = await fetch(`/api/recipes/${recipeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? t.feedback.updateError);
        }

        toast.success(t.feedback.recipeUpdated, { duration: 2500 });
        mutate("/api/carousels");
        mutate("/api/library");
        router.push(`/recipes/${recipeId}`);

        if (photoFile) {
          uploadPhoto(photoFile, recipeId).then((result) => {
            if ("error" in result) {
              toast.error(t.feedback.photoError, { duration: Infinity });
            }
          });
        }
      } else {
        const response = await fetch("/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            ingredients: ingredients.trim() || null,
            steps: steps.trim() || null,
            tagIds,
            prepTime: prepTime || null,
            cookTime: cookTime || null,
            cost: cost || null,
            complexity: complexity || null,
            seasons,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? t.feedback.saveError);
        }

        const created = await response.json();
        toast.success(t.feedback.recipeSaved, { duration: 2500 });
        mutate("/api/carousels");
        mutate("/api/library");
        router.push("/home");

        if (photoFile) {
          uploadPhoto(photoFile, created.id).then((result) => {
            if ("error" in result) {
              toast.error(t.feedback.photoError, { duration: Infinity });
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
      setIsSaving(false);
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
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.form.titlePlaceholder}
          autoFocus={!isEdit}
          autoComplete="off"
          className="h-12 text-base"
        />
      </div>

      {/* Ingredients */}
      <div className="mb-6">
        <FieldLabel htmlFor="ingredients" optional>
          {t.form.ingredientsLabel}
        </FieldLabel>
        <Textarea
          id="ingredients"
          value={ingredients ?? ""}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder={t.form.ingredientsPlaceholder}
          rows={4}
          className="resize-none text-base"
        />
      </div>

      {/* Steps */}
      <div className="mb-6">
        <FieldLabel htmlFor="steps" optional>
          {t.form.stepsLabel}
        </FieldLabel>
        <Textarea
          id="steps"
          value={steps ?? ""}
          onChange={(e) => setSteps(e.target.value)}
          placeholder={t.form.stepsPlaceholder}
          rows={5}
          className="resize-none text-base"
        />
      </div>

      {/* ===== ACT 2 — Les détails ===== */}
      <ActLabel hint="Mijote complète si tu laisses vide">Les détails</ActLabel>

      {/* Photo */}
      <div className="mb-6">
        <PhotoManager
          currentPhotoUrl={isEdit && !photoRemoved ? initialData.photoUrl : null}
          currentGeneratedUrl={isEdit && !photoRemoved ? initialData.generatedImageUrl : null}
          previewFile={photoFile}
          regenerateRequested={regenerateRequested}
          onRegenerate={() => {
            setRegenerateRequested(true);
            setPhotoFile(null);
          }}
          onReplace={(file) => {
            setPhotoFile(file);
            setPhotoRemoved(false);
            setRegenerateRequested(false);
          }}
          onRemove={() => {
            setPhotoFile(null);
            setPhotoRemoved(true);
            setRegenerateRequested(false);
          }}
        />
      </div>

      {/* Prep time */}
      <div className="mb-6">
        <FieldLabel>{t.metadata.prepTime}</FieldLabel>
        <ChipSelector
          options={PREP_TIME_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
          selected={prepTime ?? ""}
          onChange={(v) => setPrepTime((v as string) || null)}
          mode="single"
          label={t.metadata.prepTime}
        />
      </div>

      {/* Cook time */}
      <div className="mb-6">
        <FieldLabel>{t.metadata.cookTime}</FieldLabel>
        <ChipSelector
          options={COOK_TIME_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
          selected={cookTime ?? ""}
          onChange={(v) => setCookTime((v as string) || null)}
          mode="single"
          label={t.metadata.cookTime}
        />
      </div>

      {/* Cost */}
      <div className="mb-6">
        <FieldLabel>{t.metadata.cost}</FieldLabel>
        <ChipSelector
          options={COST_OPTIONS}
          selected={cost ?? ""}
          onChange={(v) => setCost((v as string) || null)}
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
          selected={complexity ?? ""}
          onChange={(v) => setComplexity((v as string) || null)}
          mode="single"
          label={t.metadata.complexity}
        />
      </div>

      {/* Tags */}
      <div className="mb-6">
        <FieldLabel optional>{t.form.tagsLabel}</FieldLabel>
        <TagInput
          selectedTags={selectedTags}
          onAdd={handleAddTag}
          onRemove={handleRemoveTag}
        />
      </div>

      {/* Seasons */}
      <div className="mb-6">
        <FieldLabel>{t.metadata.seasons}</FieldLabel>
        <ChipSelector
          options={SEASON_OPTIONS}
          selected={seasons}
          onChange={(v) => setSeasons(v as string[])}
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
          disabled={!canSave || isSaving}
          className="h-[50px] w-full min-h-[44px] rounded-xl"
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
            triggerLabel="Supprimer cette recette"
          />
        </div>
      )}
    </form>
  );
}
