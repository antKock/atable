import type { SupabaseClient } from "@supabase/supabase-js";
import { t } from "@/lib/i18n/fr";
import type { RecipeListItem, Tag } from "@/types/recipe";

export type CarouselRecipeItem = RecipeListItem & {
  prepTime: string | null;
  cookTime: string | null;
  cost: string | null;
};

export type CarouselSection = {
  key: string;
  title: string;
  recipes: CarouselRecipeItem[];
};

const CAROUSEL_SELECT =
  "id, title, ingredients, photo_url, created_at, generated_image_url, enrichment_status, image_status, prep_time, cook_time, cost, recipe_tags(tag_id, tags(id, name, category))";

// For tag-filtered queries, use !inner to make it an INNER JOIN so only matching recipes are returned
const TAG_FILTER_SELECT =
  "id, title, ingredients, photo_url, created_at, generated_image_url, enrichment_status, image_status, prep_time, cook_time, cost, recipe_tags!inner(tag_id, tags!inner(id, name, category))";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTags(row: Record<string, any>): Tag[] {
  const relationalTags = row.recipe_tags;
  if (Array.isArray(relationalTags) && relationalTags.length > 0) {
    return relationalTags
      .map(
        (
          rt: {
            tags: { id: string; name: string; category: string | null };
          } | null,
        ) =>
          rt?.tags
            ? { id: rt.tags.id, name: rt.tags.name, category: rt.tags.category }
            : null,
      )
      .filter(Boolean) as Tag[];
  }
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: Record<string, any>): CarouselRecipeItem {
  return {
    id: row.id,
    title: row.title,
    ingredients: row.ingredients,
    tags: mapTags(row),
    photoUrl: row.photo_url ?? null,
    createdAt: row.created_at,
    generatedImageUrl: row.generated_image_url ?? null,
    enrichmentStatus: row.enrichment_status ?? "none",
    imageStatus: row.image_status ?? "none",
    prepTime: row.prep_time ?? null,
    cookTime: row.cook_time ?? null,
    cost: row.cost ?? null,
  };
}

async function queryRecent(
  supabase: SupabaseClient,
  householdId: string,
): Promise<CarouselRecipeItem[]> {
  const { data } = await supabase
    .from("recipes")
    .select(CAROUSEL_SELECT)
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []).map(mapRow);
}

async function queryRecentlyViewed(
  supabase: SupabaseClient,
  householdId: string,
): Promise<CarouselRecipeItem[]> {
  const { data } = await supabase
    .from("recipes")
    .select(CAROUSEL_SELECT)
    .eq("household_id", householdId)
    .not("last_viewed_at", "is", null)
    .order("last_viewed_at", { ascending: false })
    .limit(10);
  return (data ?? []).map(mapRow);
}

async function queryRediscover(
  supabase: SupabaseClient,
  householdId: string,
): Promise<CarouselRecipeItem[]> {
  const { data } = await supabase
    .from("recipes")
    .select(CAROUSEL_SELECT)
    .eq("household_id", householdId)
    .gt("view_count", 0)
    .order("view_count", { ascending: true })
    .limit(10);
  return (data ?? []).map(mapRow);
}

async function queryByTag(
  supabase: SupabaseClient,
  householdId: string,
  tagName: string,
): Promise<CarouselRecipeItem[]> {
  const { data } = await supabase
    .from("recipes")
    .select(TAG_FILTER_SELECT)
    .eq("household_id", householdId)
    .eq("recipe_tags.tags.name", tagName)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []).map(mapRow);
}

async function queryByTags(
  supabase: SupabaseClient,
  householdId: string,
  tagNames: string[],
): Promise<CarouselRecipeItem[]> {
  const { data } = await supabase
    .from("recipes")
    .select(TAG_FILTER_SELECT)
    .eq("household_id", householdId)
    .in("recipe_tags.tags.name", tagNames)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []).map(mapRow);
}

async function queryCheap(
  supabase: SupabaseClient,
  householdId: string,
): Promise<CarouselRecipeItem[]> {
  const { data } = await supabase
    .from("recipes")
    .select(CAROUSEL_SELECT)
    .eq("household_id", householdId)
    .eq("cost", "€")
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []).map(mapRow);
}

export async function fetchCarouselSections(
  supabase: SupabaseClient,
  householdId: string,
): Promise<CarouselSection[]> {
  const [
    nouvelles,
    recentes,
    redecouvrir,
    rapide,
    vegetarien,
    comfortFood,
    pasCher,
    apero,
    desserts,
    cuisineItalienne,
    cuisineDuMonde,
    petitDejeuner,
    boissons,
  ] = await Promise.all([
    queryRecent(supabase, householdId),
    queryRecentlyViewed(supabase, householdId),
    queryRediscover(supabase, householdId),
    queryByTag(supabase, householdId, "Rapide"),
    queryByTag(supabase, householdId, "Végétarien"),
    queryByTag(supabase, householdId, "Comfort food"),
    queryCheap(supabase, householdId),
    queryByTag(supabase, householdId, "Apéro"),
    queryByTag(supabase, householdId, "Dessert"),
    queryByTag(supabase, householdId, "Italienne"),
    queryByTags(supabase, householdId, [
      "Indienne",
      "Libanaise/Orientale",
      "Mexicaine",
      "Asiatique",
      "Africaine",
      "Américaine",
    ]),
    queryByTag(supabase, householdId, "Petit-déjeuner"),
    queryByTag(supabase, householdId, "Boisson"),
  ]);

  const all: CarouselSection[] = [
    { key: "nouvelles", title: t.carousels.nouvelles, recipes: nouvelles },
    { key: "recentes", title: t.carousels.recentes, recipes: recentes },
    {
      key: "redecouvrir",
      title: t.carousels.redecouvrir,
      recipes: redecouvrir,
    },
    { key: "rapide", title: t.carousels.rapide, recipes: rapide },
    { key: "vegetarien", title: t.carousels.vegetarien, recipes: vegetarien },
    {
      key: "comfortFood",
      title: t.carousels.comfortFood,
      recipes: comfortFood,
    },
    { key: "pasCher", title: t.carousels.pasCher, recipes: pasCher },
    { key: "apero", title: t.carousels.apero, recipes: apero },
    { key: "desserts", title: t.carousels.desserts, recipes: desserts },
    {
      key: "cuisineItalienne",
      title: t.carousels.cuisineItalienne,
      recipes: cuisineItalienne,
    },
    {
      key: "cuisineDuMonde",
      title: t.carousels.cuisineDuMonde,
      recipes: cuisineDuMonde,
    },
    {
      key: "petitDejeuner",
      title: t.carousels.petitDejeuner,
      recipes: petitDejeuner,
    },
    { key: "boissons", title: t.carousels.boissons, recipes: boissons },
  ];

  return all.filter((section) => section.recipes.length > 0);
}
