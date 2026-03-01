"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n/fr";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import PhotoPicker from "./PhotoPicker";
import type { Recipe } from "@/types/recipe";

interface CreateProps {
  mode: "create";
  initialData?: never;
  recipeId?: never;
}

interface EditProps {
  mode: "edit";
  initialData: Pick<Recipe, "title" | "ingredients" | "steps" | "tags" | "photoUrl">;
  recipeId: string;
}

type RecipeFormProps = CreateProps | EditProps;

function tagsToString(tags: string[]): string {
  return tags.join(", ");
}

function stringToTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function RecipeForm({ mode, initialData, recipeId }: RecipeFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const { uploadPhoto } = usePhotoUpload();

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [ingredients, setIngredients] = useState(initialData?.ingredients ?? "");
  const [steps, setSteps] = useState(initialData?.steps ?? "");
  const [tagsInput, setTagsInput] = useState(
    initialData?.tags ? tagsToString(initialData.tags) : ""
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canSave = title.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || isSaving) return;

    setIsSaving(true);
    try {
      if (isEdit) {
        // Edit: save text fields immediately; photo upload is fire-and-forget (non-blocking).
        // This matches the create-mode pattern: recipe is always accessible regardless of photo state.
        const body: Record<string, unknown> = {
          title: title.trim(),
          ingredients: ingredients.trim() || null,
          steps: steps.trim() || null,
          tags: stringToTags(tagsInput),
        };
        // Only set photoUrl when explicitly removing — new photos upload asynchronously after save.
        if (photoRemoved) {
          body.photoUrl = null;
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
            tags: stringToTags(tagsInput),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? t.feedback.saveError);
        }

        const created = await response.json();
        toast.success(t.feedback.recipeSaved, { duration: 2500 });
        router.push("/");

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
      <PhotoPicker
        currentUrl={isEdit ? initialData.photoUrl : null}
        previewFile={photoFile}
        removed={photoRemoved}
        onChange={(file) => {
          setPhotoFile(file);
          setPhotoRemoved(false);
        }}
        onRemove={() => {
          setPhotoFile(null);
          setPhotoRemoved(true);
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
        <label htmlFor="tags" className="text-sm font-medium text-foreground">
          {t.form.tagsLabel}{" "}
          <span className="font-normal text-muted-foreground">
            {t.form.tagsOptional}
          </span>
        </label>
        <Input
          id="tags"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Ex : rapide, végétarien, dessert"
          autoComplete="off"
          className="h-12 text-base"
        />
        <p className="text-xs text-muted-foreground">
          {t.form.tagsHelper}
        </p>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        disabled={!canSave || isSaving}
        className="w-full min-h-[44px]"
      >
        {t.actions.save}
      </Button>
    </form>
  );
}
