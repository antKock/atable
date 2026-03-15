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
      className="relative block w-[70vw] flex-none overflow-hidden rounded-xl border border-border/40 active:scale-[0.97] transition-transform duration-100 lg:w-[280px]"
      style={{
        background: "var(--card-gradient)",
        boxShadow: "var(--card-shadow)",
        borderBottom: "2.5px solid var(--card-border-accent)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-xl" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)" }} />
      <div className="relative aspect-[3/2]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={recipe.title}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 280px, 70vw"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: getRecipePlaceholderGradient(recipe.id) }}
          />
        )}
      </div>
      <div className="px-1.5 py-2">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {recipe.title}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
    </Link>
  );
}
