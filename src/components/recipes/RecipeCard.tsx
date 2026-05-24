import Image from "next/image";
import Link from "next/link";
import { t } from "@/lib/i18n/fr";
import { getRecipePlaceholderGradient } from "@/lib/recipe-placeholder";
import { parseDurationMax } from "@/lib/filters";

interface RecipeCardProps {
  recipe: {
    id: string;
    title: string;
    photoUrl: string | null;
    generatedImageUrl: string | null;
    prepTime?: string | null;
    cookTime?: string | null;
    cost?: string | null;
  };
  variant?: "carousel" | "grid";
}

function formatDuration(
  prep: string | null | undefined,
  cook: string | null | undefined,
): string | null {
  const total = parseDurationMax(prep ?? null) + parseDurationMax(cook ?? null);
  if (total === 0) return null;
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

export default function RecipeCard({
  recipe,
  variant = "carousel",
}: RecipeCardProps) {
  const isCarousel = variant === "carousel";
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
      className={`group block overflow-hidden rounded-xl border border-border/40 transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isCarousel ? "w-[62vw] flex-none lg:w-[260px]" : "w-full"
      }`}
      style={{
        background: "var(--card-gradient)",
        boxShadow: "var(--card-shadow-sm)",
        borderBottom: "1px solid var(--card-border-accent)",
      }}
    >
      <div
        className={`relative w-full ${
          isCarousel ? "aspect-[3/2]" : "aspect-[3/4]"
        }`}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={t.a11y.recipePhoto(recipe.title)}
            fill
            className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
            sizes={
              isCarousel
                ? "(max-width: 1024px) 62vw, 260px"
                : "(max-width: 768px) 50vw, 33vw"
            }
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: getRecipePlaceholderGradient(recipe.id) }}
          />
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {recipe.title}
        </p>
        {subtitle && (
          <p className="mt-1 text-xs leading-tight text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
    </Link>
  );
}
