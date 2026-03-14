export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { mapDbRowToRecipe } from "@/lib/supabase/mappers";
import { t } from "@/lib/i18n/fr";
import RecipeForm from "@/components/recipes/RecipeForm";
import ConfirmDeleteDialog from "@/components/recipes/ConfirmDeleteDialog";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditRecipePage({ params }: Props) {
  const { id } = await params;
  const hdrs = await headers();
  const householdId = hdrs.get("x-household-id");
  if (!householdId) notFound();

  const supabase = createServerClient();
  const { data } = await supabase
    .from("recipes")
    .select("*, recipe_tags(tag_id, tags(id, name, category))")
    .eq("id", id)
    .eq("household_id", householdId)
    .single();

  if (!data) notFound();

  const recipe = mapDbRowToRecipe(data);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/recipes/${id}`}
            aria-label={t.a11y.backButton}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">
            {t.actions.edit}
          </h1>
        </div>
        <ConfirmDeleteDialog recipeId={id} />
      </div>

      <RecipeForm
        mode="edit"
        recipeId={id}
        initialData={{
          title: recipe.title,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          tags: recipe.tags,
          photoUrl: recipe.photoUrl,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          cost: recipe.cost,
          complexity: recipe.complexity,
          seasons: recipe.seasons,
          generatedImageUrl: recipe.generatedImageUrl,
        }}
      />
    </div>
  );
}
