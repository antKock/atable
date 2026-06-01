import Image from "next/image";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n/fr";
import { Skeleton } from "@/components/ui/skeleton";
import Chip from "@/components/recipes/Chip";
import MetadataGrid from "@/components/recipes/MetadataGrid";
import { getRecipePlaceholderGradient } from "@/lib/recipe-placeholder";
import type { Recipe } from "@/types/recipe";

function SectionLabel({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      style={{
        fontFamily: "var(--font-fraunces)",
        fontVariationSettings: '"opsz" 144',
        fontWeight: 500,
        fontSize: 20,
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
  recipe: Recipe;
  // Controls overlaid on the hero image (back button, edit/delete/share, brand
  // header…). Lets the authenticated detail page and the public share page
  // share the exact recipe rendering while supplying their own chrome.
  heroOverlay?: ReactNode;
};

// Presentational recipe body (hero + title + metadata + ingredients + steps +
// tags). Pure rendering — no data fetching, polling, or view tracking; the
// caller wraps it with whatever behavior it needs.
export default function RecipeView({ recipe, heroOverlay }: Props) {
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
      {/* Photo hero with overlaid controls */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
        {isImageLoading && !heroImageUrl ? (
          <Skeleton className="absolute inset-0 rounded-none" />
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

        {heroOverlay}
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
            <ul className="pl-4">
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
        {(recipe.tags.length > 0 ||
          (recipe.seasons && recipe.seasons.length > 0) ||
          isEnriching) && (
          <div className="mt-8 flex flex-wrap gap-2" aria-live="polite">
            {isEnriching ? (
              <>
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </>
            ) : (
              <>
                {recipe.tags.map((tag) => (
                  <Chip key={tag.id || tag.name} label={tag.name} />
                ))}
                {recipe.seasons?.map((season) => (
                  <Chip
                    key={season}
                    label={t.seasons[season as keyof typeof t.seasons] ?? season}
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
