import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { mapDbRowToRecipe } from "@/lib/supabase/mappers";
import { t } from "@/lib/i18n/fr";
import WakeLockActivator from "@/components/recipes/WakeLockActivator";
import ConfirmDeleteDialog from "@/components/recipes/ConfirmDeleteDialog";
import EnrichmentPollingWrapper from "@/components/recipes/EnrichmentPollingWrapper";
import RecipeView from "@/components/recipes/RecipeView";
import ShareButton from "@/components/recipes/ShareButton";
import BackCircleButton from "@/components/recipes/BackCircleButton";

type Props = {
  params: Promise<{ id: string }>;
};

async function getHouseholdId() {
  const hdrs = await headers();
  return hdrs.get("x-household-id");
}

async function getRecipe(id: string, householdId: string | null) {
  if (!householdId) return null;
  const supabase = createServerClient();
  const { data } = await supabase
    .from("recipes")
    .select("*, recipe_tags(tag_id, tags(id, name, category))")
    .eq("id", id)
    .eq("household_id", householdId)
    .single();
  if (!data) return null;
  return mapDbRowToRecipe(data);
}

function trackView(id: string, currentViewCount: number) {
  const supabase = createServerClient();
  supabase
    .from("recipes")
    .update({
      last_viewed_at: new Date().toISOString(),
      view_count: currentViewCount + 1,
    })
    .eq("id", id)
    .then();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const householdId = await getHouseholdId();
  const recipe = await getRecipe(id, householdId);
  if (!recipe) return {};

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
  const householdId = await getHouseholdId();
  const recipe = await getRecipe(id, householdId);

  if (!recipe) notFound();

  trackView(id, recipe.viewCount);

  const heroOverlay = (
    <>
      {/* Back button — clean white circle */}
      <BackCircleButton href="/home" />

      {/* Share + Edit + Delete pill — single white pill with separators.
          Share is the first action (Lot 3 grammar: ink glyph, same size/stroke
          as the others, no tint). */}
      <div
        className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full p-1"
        style={{
          background: "#fff",
          boxShadow:
            "0 2px 8px rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.10)",
        }}
      >
        <ShareButton
          recipeId={id}
          recipeTitle={recipe.title}
          className="flex h-7 w-7 items-center justify-center rounded-full text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          iconSize={14}
          iconStroke={1.75}
        />
        <div className="h-4 w-px bg-border" />
        <Link
          href={`/recipes/${id}/edit`}
          aria-label={t.actions.edit}
          className="flex h-7 w-7 items-center justify-center rounded-full text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil size={14} strokeWidth={1.75} />
        </Link>
        <div className="h-4 w-px bg-border" />
        <ConfirmDeleteDialog
          recipeId={id}
          triggerClassName="flex h-7 w-7 items-center justify-center rounded-full text-foreground hover:bg-secondary hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          triggerIconSize={14}
          triggerIconStroke={1.75}
        />
      </div>
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
      <RecipeView recipe={recipe} heroOverlay={heroOverlay} />
    </>
  );
}
