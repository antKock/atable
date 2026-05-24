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
import Chip from "@/components/recipes/Chip";
import { getRecipePlaceholderGradient } from "@/lib/recipe-placeholder";

function SectionLabel({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      style={{
        fontFamily: "var(--font-fraunces)",
        fontVariationSettings: '"opsz" 144',
        fontStyle: "italic",
        fontWeight: 500,
        fontSize: 16,
        color: "var(--accent)",
        letterSpacing: "-0.005em",
        marginBottom: 14,
      }}
    >
      {children}
    </h2>
  );
}

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

        {/* Back button — clean white circle */}
        <Link
          href="/home"
          aria-label={t.a11y.backButton}
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{
            background: "#fff",
            boxShadow:
              "0 2px 8px rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.10)",
          }}
        >
          <ArrowLeft size={18} strokeWidth={1.75} />
        </Link>

        {/* Edit + Delete pill — single white pill with separator */}
        <div
          className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full p-1"
          style={{
            background: "#fff",
            boxShadow:
              "0 2px 8px rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.10)",
          }}
        >
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
      </div>

      {/* Recipe content */}
      <div className="px-4 pt-6">
        <h1
          className="text-foreground"
          style={{
            fontFamily: "var(--font-fraunces)",
            fontVariationSettings: '"opsz" 144',
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            textWrap: "balance",
          }}
        >
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
          <section aria-labelledby="ingredients-heading" className="mt-8">
            <SectionLabel id="ingredients-heading">
              {t.detail.ingredients}
            </SectionLabel>
            <ul className="divide-y divide-border">
              {ingredientLines.map((line, i) => (
                <li key={i} className="py-2.5 text-base text-foreground">
                  {line.trim()}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Steps */}
        {stepLines.length > 0 && (
          <section aria-labelledby="steps-heading" className="mt-8">
            <SectionLabel id="steps-heading">{t.detail.steps}</SectionLabel>
            <ol className="flex flex-col gap-4">
                {stepLines.map((line, i) => (
                  <li key={i} className="flex gap-3">
                    <span
                      className="flex-shrink-0"
                      style={{
                        minWidth: 28,
                        fontFamily: "var(--font-fraunces)",
                        fontVariationSettings: '"opsz" 144',
                        fontStyle: "italic",
                        fontWeight: 500,
                        fontSize: 24,
                        lineHeight: 1.05,
                        color: "var(--accent)",
                        textAlign: "right",
                        transform: "translateY(2px)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <p className="flex-1 text-base leading-relaxed text-foreground">
                      {line.trim()}
                    </p>
                  </li>
                ))}
              </ol>
          </section>
        )}

        {/* Tags + Seasons */}
        {(recipe.tags.length > 0 || (recipe.seasons && recipe.seasons.length > 0) || isEnriching) && (
          <div className="mt-8 flex flex-wrap gap-2" aria-live="polite">
              {isEnriching ? (
                <>
                  <ShimmerBlock variant="pill" className="w-16" />
                  <ShimmerBlock variant="pill" className="w-20" />
                  <ShimmerBlock variant="pill" className="w-14" />
                </>
              ) : (
                <>
                  {recipe.tags.map((tag) => (
                    <Chip key={tag.id || tag.name} label={tag.name} />
                  ))}
                  {recipe.seasons?.map((season) => (
                    <Chip
                      key={season}
                      label={
                        t.seasons[season as keyof typeof t.seasons] ?? season
                      }
                    />
                  ))}
                </>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
