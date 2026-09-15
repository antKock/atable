"use client";

import { useT } from "@/lib/i18n/client";
import RecipeCard from "@/components/recipes/card/RecipeCard";
import type { CarouselRecipeItem } from "@/lib/queries/carousels";

interface RecipeCarouselProps {
  title: string;
  recipes: CarouselRecipeItem[];
  /** Identifiant `data-track` (#28) : un clic sur une carte = ce carrousel. */
  track?: string;
}

export default function RecipeCarousel({ title, recipes, track }: RecipeCarouselProps) {
  const t = useT();
  if (recipes.length === 0) return null;

  return (
    <section role="region" aria-label={t.a11y.carousel(title)}>
      <h2
        className="display mb-3 px-4 text-foreground"
        style={{
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} variant="carousel" track={track} />
        ))}
      </div>
    </section>
  );
}
