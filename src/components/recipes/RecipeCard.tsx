import Image from "next/image";
import Link from "next/link";
import { t } from "@/lib/i18n/fr";
import type { RecipeListItem } from "@/types/recipe";

interface RecipeCardProps {
  recipe: RecipeListItem;
  variant?: "carousel" | "grid";
}

export default function RecipeCard({
  recipe,
  variant = "carousel",
}: RecipeCardProps) {
  const isCarousel = variant === "carousel";

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      aria-label={t.a11y.recipeCard(recipe.title)}
      className={`group relative block overflow-hidden rounded-xl bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isCarousel ? "w-44 flex-none lg:w-56" : "w-full"
      }`}
    >
      <div className="relative aspect-[3/4] w-full">
        {recipe.photoUrl ? (
          <Image
            src={recipe.photoUrl}
            alt={t.a11y.recipePhoto(recipe.title)}
            fill
            className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
            sizes={
              isCarousel
                ? "(max-width: 1024px) 176px, 224px"
                : "(max-width: 768px) 50vw, 33vw"
            }
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
            <div className="h-12 w-12 rounded-full border-4 border-accent/20" />
          </div>
        )}
        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-white">
            {recipe.title}
          </p>
        </div>
      </div>
    </Link>
  );
}
