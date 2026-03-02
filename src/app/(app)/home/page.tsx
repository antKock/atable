import Link from "next/link";
import { Users } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { t } from "@/lib/i18n/fr";
import HomeContent from "@/components/recipes/HomeContent";
import PostCreationBanner from "@/components/auth/PostCreationBanner";
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

type Props = {
  searchParams: Promise<{ code?: string; householdName?: string }>
}

export default async function HomePage({ searchParams }: Props) {
  const { code, householdName } = await searchParams
  const hdrs = await headers()
  const householdId = hdrs.get('x-household-id')
  const sessionId = hdrs.get('x-session-id')
  console.log(`[home/page] x-household-id=${householdId} x-session-id=${sessionId}`)

  if (!householdId) {
    console.log(`[home/page] no x-household-id → redirect /`)
    redirect('/')
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, ingredients, tags, photo_url, created_at")
    .eq("household_id", householdId)
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
      <header className="mb-4 flex items-center justify-between px-4">
        <h1 className="text-[22px] font-extrabold tracking-tight">
          <span className="text-foreground">a</span>
          <span className="text-accent">table</span>
        </h1>
        <Link
          href="/household"
          aria-label={t.household.menuButton}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Users size={20} />
        </Link>
      </header>
      {code && householdName && (
        <PostCreationBanner
          householdName={decodeURIComponent(householdName)}
          code={decodeURIComponent(code)}
        />
      )}
      <HomeContent recipes={recipes} carousels={carousels} />
    </div>
  );
}
