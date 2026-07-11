import Image from "next/image";
import Link from "next/link";
import { t } from "@/lib/i18n/fr";
import { Skeleton } from "@/components/ui/skeleton";
import { getRecipePlaceholderGradient } from "@/lib/recipe-placeholder";
import { parseDurationMax } from "@/lib/filters";

interface RecipeCardProps {
  recipe: {
    id: string;
    title: string;
    photoUrl: string | null;
    generatedImageUrl: string | null;
    imageStatus?: string;
    prepTime?: string | null;
    cookTime?: string | null;
    cost?: string | null;
  };
  variant?: "carousel" | "grid";
  // Marqueur d'origine (multi-foyer, Lot 4) : label texte discret sous le
  // sous-titre, jamais de couleur ni d'œil (décision n°11). Vue biblio
  // uniquement, jamais la home — l'appelant ne le passe que quand pertinent.
  householdName?: string | null;
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
  householdName = null,
}: RecipeCardProps) {
  const isCarousel = variant === "carousel";
  const imageUrl = recipe.photoUrl ?? recipe.generatedImageUrl;
  const duration = formatDuration(recipe.prepTime, recipe.cookTime);
  // Always render the subtitle line with "—" placeholders so cards keep a
  // uniform height — metadata arrives ~20s later via AI enrichment.
  const subtitle = `${duration ?? "—"} · ${recipe.cost ?? "—"}`;

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      aria-label={recipe.title}
      className={`group block overflow-hidden rounded-xl border border-border/40 transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isCarousel ? "w-[62vw] flex-none lg:w-65" : "w-full"
      }`}
      style={{
        background: "var(--card-gradient)",
        boxShadow: "var(--card-shadow-sm)",
        borderBottom: "1px solid var(--card-border-accent)",
      }}
    >
      <div
        className={`relative w-full ${
          isCarousel ? "aspect-3/2" : "aspect-[3/4]"
        }`}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={t.a11y.recipePhoto(recipe.title)}
            fill
            className="object-cover"
            sizes={
              isCarousel
                ? "(max-width: 1024px) 62vw, 260px"
                : "(max-width: 768px) 50vw, 33vw"
            }
          />
        ) : recipe.imageStatus === "pending" ? (
          <Skeleton className="absolute inset-0 rounded-none" />
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
        <p className="mt-1 text-xs leading-tight text-muted-foreground">
          {subtitle}
        </p>
        {householdName && (
          <p className="mt-1 truncate text-[11px] leading-tight text-muted-foreground/80">
            {householdName}
          </p>
        )}
      </div>
    </Link>
  );
}
