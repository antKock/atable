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

        // Fire-and-forget background upload after redirect (same pattern as create mode)
        if (photoFile) {
          uploadPhoto(photoFile, recipeId).then((result) => {
            if ("error" in result) {
              toast.error(t.feedback.photoError, { duration: Infinity });
            }
          });
        }
      } else {
        // Create: POST text first, then upload photo in background
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

        // Fire-and-forget background upload after redirect
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium text-foreground">
          {t.form.titleLabel}{" "}
          <span className="font-normal text-muted-foreground">
            {t.form.titleRequired}
          </span>
        </label>
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

      {/* Photo */}
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

      {/* Ingredients */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="ingredients"
          className="text-sm font-medium text-foreground"
        >
          {t.form.ingredientsLabel}{" "}
          <span className="font-normal text-muted-foreground">
            {t.form.ingredientsOptional}
          </span>
        </label>
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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="steps" className="text-sm font-medium text-foreground">
          {t.form.stepsLabel}{" "}
          <span className="font-normal text-muted-foreground">
            {t.form.stepsOptional}
          </span>
        </label>
        <Textarea
          id="steps"
          value={steps ?? ""}
          onChange={(e) => setSteps(e.target.value)}
          placeholder={t.form.stepsPlaceholder}
          rows={5}
          className="resize-none text-base"
        />
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          {t.form.tagsLabel}{" "}
          <span className="font-normal text-muted-foreground">
            {t.form.tagsOptional}
          </span>
        </label>
        <TagInput
          selectedTags={selectedTags}
          onAdd={handleAddTag}
          onRemove={handleRemoveTag}
        />
      </div>

      {/* Prep time & Cook time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prepTime" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {t.metadata.prepTime}
          </label>
          <select
            id="prepTime"
            value={prepTime ?? ""}
            onChange={(e) => setPrepTime(e.target.value || null)}
            className="h-12 rounded-md border border-border bg-background px-3 text-base text-foreground"
          >
            <option value="">—</option>
            {PREP_TIME_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cookTime" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {t.metadata.cookTime}
          </label>
          <select
            id="cookTime"
            value={cookTime ?? ""}
            onChange={(e) => setCookTime(e.target.value || null)}
            className="h-12 rounded-md border border-border bg-background px-3 text-base text-foreground"
          >
            <option value="">—</option>
            {COOK_TIME_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cost */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t.metadata.cost}
        </span>
        <ChipSelector
          options={COST_OPTIONS}
          selected={cost ?? ""}
          onChange={(v) => setCost((v as string) || null)}
          mode="single"
          label={t.metadata.cost}
        />
      </div>

      {/* Complexity */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="complexity" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t.metadata.complexity}
        </label>
        <select
          id="complexity"
          value={complexity ?? ""}
          onChange={(e) => setComplexity(e.target.value || null)}
          className="h-12 rounded-md border border-border bg-background px-3 text-base text-foreground"
        >
          <option value="">—</option>
          {COMPLEXITY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{t.complexity[opt as keyof typeof t.complexity]}</option>
          ))}
        </select>
      </div>

      {/* Seasons */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t.metadata.seasons}
        </span>
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
        className={stickySubmit
          ? "sticky bottom-0 bg-background pt-3 border-t border-border/50 shadow-[0_-8px_16px_-4px_rgba(0,0,0,0.06)]"
          : undefined}
        style={stickySubmit ? { paddingBottom: "max(1rem, env(safe-area-inset-bottom))" } : undefined}
      >
        <Button
          type="submit"
          size="lg"
          disabled={!canSave || isSaving}
          className="w-full min-h-[44px]"
        >
          {t.actions.save}
        </Button>
      </div>
    </form>
  );
}
