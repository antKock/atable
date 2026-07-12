import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { mapDbRowToRecipe } from "@/lib/supabase/mappers";
import {
  getOwnerContext,
  householdIds,
  memberHouseholdIds,
  roleForHousehold,
  type OwnerContext,
} from "@/lib/auth/owner-context";
import WakeLockActivator from "@/components/recipes/WakeLockActivator";
import EnrichmentPollingWrapper from "@/components/recipes/EnrichmentPollingWrapper";
import RecipeView from "@/components/recipes/RecipeView";
import RecipeActionPill from "@/components/recipes/RecipeActionPill";
import BackCircleButton from "@/components/recipes/BackCircleButton";

type Props = {
  params: Promise<{ id: string }>;
};

// Fiche accessible si la recette vit dans l'UN des foyers de l'owner (membre OU
// invité) — plus seulement le foyer du cookie (multi-foyer, Lot 4). Renvoie la
// recette + son foyer d'origine (pour le rôle et le déplacement).
async function getRecipe(id: string, owner: OwnerContext | null) {
  if (!owner) return null;
  const supabase = createServerClient();
  const { data } = await supabase
    .from("recipes")
    .select("*, recipe_tags(tag_id, tags(id, name, category))")
    .eq("id", id)
    .in("household_id", householdIds(owner))
    .single();
  if (!data) return null;
  return { recipe: mapDbRowToRecipe(data), householdId: data.household_id as string };
}

function trackView(id: string, currentViewCount: number) {
  const supabase = createServerClient();
  supabase
    .from("recipes")
    .update({
      last_activity_at: new Date().toISOString(),
      view_count: currentViewCount + 1,
    })
    .eq("id", id)
    .then();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const owner = await getOwnerContext();
  const result = await getRecipe(id, owner);
  if (!result) return {};
  const { recipe } = result;

  const description = recipe.tags.length > 0
    ? recipe.tags.map((tag) => tag.name).join(", ")
    : "Une recette sur Mijote";

  return {
    title: recipe.title,
    description,
    openGraph: {
      title: recipe.title,
      description,
      ...(recipe.photoUrl && {
        images: [{ url: recipe.photoUrl }],
      }),
    },
  };
}

export default async function RecipeDetailPage({ params }: Props) {
  const { id } = await params;
  const owner = await getOwnerContext();
  const result = await getRecipe(id, owner);

  if (!result || !owner) notFound();
  const { recipe, householdId } = result;

  trackView(id, recipe.viewCount);

  // Rôle du viewer sur LE foyer de la recette (multi-foyer, Lot 4) : la pill
  // d'actions (partager/éditer/supprimer/déplacer) n'apparaît que pour un
  // MEMBRE de ce foyer précis — un owner peut être membre de A et invité de C.
  const isMember = roleForHousehold(owner, householdId) === "member";

  // Multi-foyer : nom du foyer d'origine, affiché sous le titre comme un tag.
  // Mono-foyer → inutile (un seul foyer possible, aucune ambiguïté d'origine).
  let householdName: string | null = null;
  if (householdIds(owner).length > 1) {
    const { data } = await createServerClient()
      .from("households")
      .select("name")
      .eq("id", householdId)
      .single();
    householdName = (data?.name as string | undefined) ?? null;
  }

  // Destinations de « Déplacer » : les foyers où l'owner est membre (noms lus
  // en une requête). La pill masque l'icône s'il n'y a pas d'autre foyer.
  let memberFoyers: { id: string; name: string }[] = [];
  if (isMember) {
    const memberIds = memberHouseholdIds(owner);
    if (memberIds.length > 1) {
      const { data } = await createServerClient()
        .from("households")
        .select("id, name")
        .in("id", memberIds);
      const byId = new Map((data ?? []).map((h) => [h.id, h.name]));
      memberFoyers = memberIds
        .filter((mid) => byId.has(mid))
        .map((mid) => ({ id: mid, name: byId.get(mid) as string }));
    }
  }

  const heroOverlay = (
    <>
      {/* Back button — clean white circle */}
      <BackCircleButton href="/home" />

      {/* Pill d'actions (client). Un INVITÉ n'a que « Partager » (le reste —
          éditer/supprimer/déplacer — reste réservé aux membres via canManage).
          « Déplacer » n'apparaît qu'avec ≥2 foyers membres. */}
      <RecipeActionPill
        recipeId={id}
        recipeTitle={recipe.title}
        currentHouseholdId={householdId}
        memberFoyers={memberFoyers}
        canManage={isMember}
      />
    </>
  );

  return (
    <>
      <WakeLockActivator />
      <EnrichmentPollingWrapper
        recipeId={id}
        enrichmentStatus={recipe.enrichmentStatus}
        imageStatus={recipe.imageStatus}
      />
      <RecipeView recipe={recipe} householdName={householdName} heroOverlay={heroOverlay} />
    </>
  );
}
