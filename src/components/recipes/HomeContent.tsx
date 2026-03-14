"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import useSWR from "swr";
import { t } from "@/lib/i18n/fr";
import RecipeCarousel from "./RecipeCarousel";
import type { CarouselSection } from "@/lib/queries/carousels";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface HomeContentProps {
  carouselSections: CarouselSection[];
  hasRecipes: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function HomeContent({
  carouselSections,
  hasRecipes,
}: HomeContentProps) {
  const { data: sections } = useSWR<CarouselSection[]>(
    "/api/carousels",
    fetcher,
    { fallbackData: carouselSections, revalidateOnMount: true },
  );

  const liveSections = sections ?? carouselSections;
  const liveHasRecipes = hasRecipes || liveSections.length > 0;

  const orderedSections = useMemo(() => {
    const nouvelles = liveSections.find((s) => s.key === "nouvelles");
    const rest = liveSections.filter((s) => s.key !== "nouvelles");
    const shuffled = shuffleArray(rest);
    return nouvelles ? [nouvelles, ...shuffled] : shuffled;
  }, [liveSections]);

  return (
    <>
      {/* Search bar — tappable redirect to library */}
      <div className="px-4 pb-4">
        <Link
          href="/library?search=true"
          className="relative flex h-11 w-full items-center rounded-xl border border-input bg-surface pl-10 pr-4 text-base text-muted-foreground"
        >
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <span>{t.search.placeholder}</span>
        </Link>
      </div>

      {/* Carousels or empty state */}
      {!liveHasRecipes ? (
        <div className="mx-auto mt-16 max-w-xs px-4 text-center">
          <p className="text-lg font-medium text-foreground">
            {t.empty.libraryTitle}
          </p>
          <p className="mt-2 text-muted-foreground">{t.empty.libraryBody}</p>
          <Link
            href="/recipes/new"
            className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-accent px-6 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            {t.actions.addRecipe}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {orderedSections.map(({ key, title, recipes }) => (
            <RecipeCarousel key={key} title={title} recipes={recipes} />
          ))}
        </div>
      )}
    </>
  );
}
