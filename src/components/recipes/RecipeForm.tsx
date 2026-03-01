"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n/fr";

function stringToTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function RecipeForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canSave = title.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || isSaving) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          ingredients: ingredients.trim() || undefined,
          steps: steps.trim() || undefined,
          tags: stringToTags(tagsInput),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? t.feedback.saveError);
      }

      toast.success(t.feedback.recipeSaved, { duration: 2500 });
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.feedback.saveError, {
        duration: Infinity,
      });
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
          autoFocus
          autoComplete="off"
          className="h-12 text-base"
        />
      </div>

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
          value={ingredients}
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
          value={steps}
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
          Séparez les tags par des virgules
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
