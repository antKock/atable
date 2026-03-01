import { t } from "@/lib/i18n/fr";
import RecipeCard from "./RecipeCard";
import type { RecipeListItem } from "@/types/recipe";

interface RecipeCarouselProps {
  title: string;
  recipes: RecipeListItem[];
}

export default function RecipeCarousel({ title, recipes }: RecipeCarouselProps) {
  if (recipes.length === 0) return null;

  return (
    <section aria-label={t.a11y.carousel(title)}>
      <h2 className="mb-3 px-4 text-lg font-semibold text-foreground capitalize">
        {title}
      </h2>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} variant="carousel" />
        ))}
      </div>
    </section>
  );
}
