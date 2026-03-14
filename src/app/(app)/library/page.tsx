import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/fr";
import { mapDbRowToRecipeListItem } from "@/lib/supabase/mappers";
import LibraryContent from "@/components/recipes/LibraryContent";
import type { LibraryRecipeItem, Tag } from "@/types/recipe";

type Props = {
  searchParams: Promise<{ search?: string }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToLibraryItem(row: Record<string, any>): LibraryRecipeItem {
  return {
    ...mapDbRowToRecipeListItem(row),
    prepTime: row.prep_time ?? null,
    cookTime: row.cook_time ?? null,
    cost: row.cost ?? null,
    seasons: row.seasons ?? [],
  };
}

export default async function LibraryPage({ searchParams }: Props) {
  const { search } = await searchParams;
  const hdrs = await headers();
  const householdId = hdrs.get("x-household-id");
  if (!householdId) redirect("/");

  const supabase = createServerClient();

  const [recipesResult, tagsResult] = await Promise.all([
    supabase
      .from("recipes")
      .select(
        "id, title, ingredients, tags, photo_url, created_at, generated_image_url, enrichment_status, image_status, prep_time, cook_time, cost, seasons, recipe_tags(tag_id, tags(id, name, category))",
      )
      .eq("household_id", householdId)
      .order("created_at", { ascending: false }),
    supabase.from("tags").select("id, name, category").order("name"),
  ]);

  if (recipesResult.error) throw recipesResult.error;
  if (tagsResult.error) throw tagsResult.error;

  const recipes: LibraryRecipeItem[] = (recipesResult.data ?? []).map(
    mapToLibraryItem,
  );

  const allTags: Tag[] = (tagsResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
  }));

  return (
    <div className="pb-8 pt-6">
      <h1 className="mb-4 px-4 text-2xl font-semibold text-foreground">
        {t.nav.library}
      </h1>
      <Suspense>
        <LibraryContent
          recipes={recipes}
          tags={allTags}
          autoFocusSearch={search === "true"}
        />
      </Suspense>
    </div>
  );
}
