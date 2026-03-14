import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { mapDbRowToRecipe } from "@/lib/supabase/mappers";
import { t } from "@/lib/i18n/fr";
import WakeLockActivator from "@/components/recipes/WakeLockActivator";
import ConfirmDeleteDialog from "@/components/recipes/ConfirmDeleteDialog";
import EnrichmentPollingWrapper from "@/components/recipes/EnrichmentPollingWrapper";
import MetadataGrid from "@/components/recipes/MetadataGrid";
import ShimmerBlock from "@/components/recipes/ShimmerBlock";
import TagChip from "@/components/recipes/TagChip";
import SeasonBadge from "@/components/recipes/SeasonBadge";
import { getRecipePlaceholderGradient } from "@/lib/recipe-placeholder";

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
    : "Une recette sur atable";

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

  const ingredientLines = recipe.ingredients
    ? recipe.ingredients.split("\n").filter((l) => l.trim())
    : [];
  const stepLines = recipe.steps
    ? recipe.steps.split("\n").filter((l) => l.trim())
    : [];

  const isEnriching = recipe.enrichmentStatus === "pending";
  const isImageLoading = recipe.imageStatus === "pending";

  // Image priority: user photo > generated image > placeholder
  const heroImageUrl = recipe.photoUrl ?? recipe.generatedImageUrl;

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <WakeLockActivator />
      <EnrichmentPollingWrapper
        recipeId={id}
        enrichmentStatus={recipe.enrichmentStatus}
        imageStatus={recipe.imageStatus}
      />

      {/* Photo hero with overlaid controls */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
        {isImageLoading && !heroImageUrl ? (
          <ShimmerBlock variant="image" className="absolute inset-0" />
        ) : heroImageUrl ? (
          <Image
            src={heroImageUrl}
            alt={recipe.imagePrompt ?? t.a11y.recipePhoto(recipe.title)}
            fill
            className="object-cover transition-opacity"
            style={{ transitionDuration: "var(--reveal-duration)" }}
            sizes="(max-width: 768px) 100vw, 672px"
            priority
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: getRecipePlaceholderGradient(recipe.id) }}
          />
        )}

        {/* Back button — frosted glass, overlaid top-left */}
        <Link
          href="/home"
          aria-label={t.a11y.backButton}
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} />
        </Link>

        {/* Edit + Delete — frosted glass, overlaid top-right */}
        <div className="absolute right-3 top-3 flex gap-1.5">
          <Link
            href={`/recipes/${id}/edit`}
            aria-label={t.actions.edit}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil size={16} />
          </Link>
          <ConfirmDeleteDialog
            recipeId={id}
            triggerClassName="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Recipe content */}
      <div className="px-4 pt-6">
        <h1 className="font-serif text-[22px] font-bold leading-tight tracking-[-0.4px] text-foreground">
          {recipe.title}
        </h1>

        {/* MetadataGrid */}
        <div className="mt-4">
          <MetadataGrid
            prepTime={recipe.prepTime}
            cookTime={recipe.cookTime}
            cost={recipe.cost}
            complexity={recipe.complexity}
            isLoading={isEnriching}
          />
        </div>

        {/* Ingredients */}
        {ingredientLines.length > 0 && (
          <>
            <div className="my-5 h-px bg-border" />
            <section aria-labelledby="ingredients-heading">
              <h2
                id="ingredients-heading"
                className="mb-3 text-[11px] font-bold uppercase tracking-[0.9px] text-muted-foreground"
              >
                {t.detail.ingredients}
              </h2>
              <ul className="divide-y divide-border">
                {ingredientLines.map((line, i) => (
                  <li key={i} className="py-2.5 text-base text-foreground">
                    {line.trim()}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {/* Steps */}
        {stepLines.length > 0 && (
          <>
            <div className="my-5 h-px bg-border" />
            <section aria-labelledby="steps-heading">
              <h2
                id="steps-heading"
                className="mb-4 text-[11px] font-bold uppercase tracking-[0.9px] text-muted-foreground"
              >
                {t.detail.steps}
              </h2>
              <ol className="flex flex-col gap-4">
                {stepLines.map((line, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                      {i + 1}
                    </span>
                    <p className="flex-1 text-base leading-relaxed text-foreground">
                      {line.trim()}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        {/* Tags + Seasons */}
        {(recipe.tags.length > 0 || (recipe.seasons && recipe.seasons.length > 0) || isEnriching) && (
          <>
            <div className="my-5 h-px bg-border" />
            <div className="flex flex-wrap gap-2" aria-live="polite">
              {isEnriching ? (
                <>
                  <ShimmerBlock variant="pill" className="w-16" />
                  <ShimmerBlock variant="pill" className="w-20" />
                  <ShimmerBlock variant="pill" className="w-14" />
                </>
              ) : (
                <>
                  {recipe.tags.map((tag) => (
                    <TagChip key={tag.id || tag.name} name={tag.name} />
                  ))}
                  {recipe.seasons?.map((season) => (
                    <SeasonBadge key={season} season={season} />
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
