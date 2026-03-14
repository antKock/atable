import Image from "next/image";
import Link from "next/link";
import { t } from "@/lib/i18n/fr";
import { getRecipePlaceholderGradient } from "@/lib/recipe-placeholder";
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
  const imageUrl = recipe.photoUrl ?? recipe.generatedImageUrl;

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      aria-label={t.a11y.recipeCard(recipe.title)}
      className={`group relative block overflow-hidden rounded-xl bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isCarousel ? "w-56 flex-none lg:w-64" : "w-full"
      }`}
    >
      <div className={`relative w-full ${isCarousel ? "aspect-[3/2]" : "aspect-[3/4]"}`}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={t.a11y.recipePhoto(recipe.title)}
            fill
            className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
            sizes={
              isCarousel
                ? "(max-width: 1024px) 224px, 256px"
                : "(max-width: 768px) 50vw, 33vw"
            }
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: getRecipePlaceholderGradient(recipe.id) }}
          />
        )}
        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/68 to-transparent p-3">
          <p className="line-clamp-2 text-sm font-bold leading-snug text-white">
            {recipe.title}
          </p>
          {isCarousel && recipe.tags[0] && (
            <p className="mt-0.5 text-[10px] text-white/72 leading-tight">
              {recipe.tags[0].name}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
