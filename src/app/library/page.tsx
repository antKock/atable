import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/fr";
import RecipeCard from "@/components/recipes/RecipeCard";
import type { RecipeListItem } from "@/types/recipe";

export default async function LibraryPage() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("recipes")
    .select("id, title, tags, photo_url, created_at")
    .order("created_at", { ascending: false });

  const recipes: RecipeListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    tags: row.tags ?? [],
    photoUrl: row.photo_url,
    createdAt: row.created_at,
  }));

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
