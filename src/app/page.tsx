export const dynamic = "force-dynamic";

import { createServerClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/fr";
import HomeContent from "@/components/recipes/HomeContent";
import type { RecipeListItem } from "@/types/recipe";

function buildCarousels(recipes: RecipeListItem[]) {
  const carousels: { key: string; title: string; recipes: RecipeListItem[] }[] =
    [];

  if (recipes.length === 0) return carousels;

  carousels.push({
    key: "__recent",
    title: t.carousels.recent,
    recipes: recipes.slice(0, 12),
  });

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
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, ingredients, tags, photo_url, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const recipes: RecipeListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    ingredients: row.ingredients,
    tags: row.tags ?? [],
    photoUrl: row.photo_url,
    createdAt: row.created_at,
  }));

  const carousels = buildCarousels(recipes);

  return (
    <div className="pb-6 pt-6">
      <h1 className="mb-4 px-4 text-2xl font-semibold text-foreground">
        {t.appName}
      </h1>
      <HomeContent recipes={recipes} carousels={carousels} />
    </div>
  );
}
