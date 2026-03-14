import Image from "next/image";
import Link from "next/link";
import { getRecipePlaceholderGradient } from "@/lib/recipe-placeholder";
import { parseDurationMax } from "@/lib/filters";
import type { CarouselRecipeItem } from "@/lib/queries/carousels";

export function formatDuration(
  prepTime: string | null,
  cookTime: string | null,
): string | null {
  const total = parseDurationMax(prepTime) + parseDurationMax(cookTime);
  if (total === 0) return null;
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

interface RecipeCardCarouselProps {
  recipe: CarouselRecipeItem;
}

export default function RecipeCardCarousel({
  recipe,
}: RecipeCardCarouselProps) {
  const imageUrl = recipe.photoUrl ?? recipe.generatedImageUrl;
  const duration = formatDuration(recipe.prepTime, recipe.cookTime);

  const subtitleParts: string[] = [];
  if (duration) subtitleParts.push(duration);
  if (recipe.cost) subtitleParts.push(recipe.cost);
  const subtitle = subtitleParts.join(" · ");

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      aria-label={recipe.title}
      className="block w-[140px] flex-none overflow-hidden rounded-lg active:scale-[0.97] transition-transform duration-100 lg:w-[180px]"
    >
      <div className="relative aspect-[3/2]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={recipe.title}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 180px, 140px"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: getRecipePlaceholderGradient(recipe.id) }}
          />
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-white">
            {recipe.title}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-[11px] leading-tight text-white/70">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
