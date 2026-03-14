import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/fr";
import RecipeCard from "@/components/recipes/RecipeCard";
import { mapDbRowToRecipeListItem } from "@/lib/supabase/mappers";
import type { RecipeListItem } from "@/types/recipe";

export default async function LibraryPage() {
  const hdrs = await headers();
  const householdId = hdrs.get("x-household-id");
  if (!householdId) redirect("/");

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, ingredients, tags, photo_url, created_at, generated_image_url, enrichment_status, image_status, recipe_tags(tag_id, tags(id, name, category))")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const recipes: RecipeListItem[] = (data ?? []).map(mapDbRowToRecipeListItem);

  return (
    <div className="px-4 pb-8 pt-6">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">
        {t.nav.library}
      </h1>

      {recipes.length === 0 ? (
        <div className="mx-auto mt-16 max-w-xs text-center">
          <p className="text-lg font-medium text-foreground">
            {t.empty.libraryTitle}
          </p>
          <p className="mt-2 text-muted-foreground">{t.empty.libraryBody}</p>
          <Link
            href="/recipes/new"
            className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-accent px-6 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            {t.actions.addRecipe}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} variant="grid" />
          ))}
        </div>
      )}
    </div>
  );
}
