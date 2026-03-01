export const dynamic = "force-dynamic";

import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/fr";
import RecipeCarousel from "@/components/recipes/RecipeCarousel";
import type { RecipeListItem } from "@/types/recipe";

function buildCarousels(recipes: RecipeListItem[]) {
  const carousels: { key: string; title: string; recipes: RecipeListItem[] }[] =
    [];

  if (recipes.length === 0) return carousels;

  // "Récentes" — always first, shows all recipes (newest first)
  carousels.push({
    key: "__recent",
    title: t.carousels.recent,
    recipes: recipes.slice(0, 12),
  });

  // Tag-based carousels — one per unique tag, only if at least 1 recipe
  const tagMap = new Map<string, RecipeListItem[]>();
  for (const recipe of recipes) {
    for (const tag of recipe.tags) {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag)!.push(recipe);
    }
  }
  for (const [tag, tagRecipes] of tagMap) {
    carousels.push({ key: tag, title: tag, recipes: tagRecipes });
  }

  return carousels;
}

export default async function HomePage() {
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

  const carousels = buildCarousels(recipes);

  return (
    <div className="pb-6 pt-6">
      <h1 className="mb-6 px-4 text-2xl font-semibold text-foreground">
        {t.appName}
      </h1>

      {carousels.length === 0 ? (
        <div className="mx-auto mt-16 max-w-xs px-4 text-center">
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
        <div className="flex flex-col gap-8">
          {carousels.map(({ key, title, recipes: carouselRecipes }) => (
            <RecipeCarousel key={key} title={title} recipes={carouselRecipes} />
          ))}
        </div>
      )}
    </div>
  );
}
