"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import useSWR from "swr";
import { t } from "@/lib/i18n/fr";
import { Skeleton } from "@/components/ui/skeleton";
import RecipeCarousel from "./RecipeCarousel";
import type { CarouselSection } from "@/lib/queries/carousels";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function CarouselCardSkeleton() {
  return (
    <div className="w-[70vw] flex-none overflow-hidden rounded-xl border border-border/40 lg:w-[280px]" style={{ background: "var(--card-gradient)", boxShadow: "var(--card-shadow)" }}>
      <Skeleton className="aspect-[3/2] w-full rounded-none" />
      <div className="px-1.5 py-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-1 h-3 w-1/2" />
      </div>
    </div>
  );
}

function CarouselSkeleton() {
  return (
    <div>
      <Skeleton className="mb-3 ml-4 h-5 w-28" />
      <div className="flex gap-3 overflow-hidden px-4">
        <CarouselCardSkeleton />
        <CarouselCardSkeleton />
      </div>
    </div>
  );
}

export default function HomeContent() {
  const { data: sections, isLoading } = useSWR<CarouselSection[]>(
    "/api/carousels",
    fetcher,
    { revalidateOnMount: true },
  );

  const hasRecipes = sections && sections.length > 0;

  const orderedSections = useMemo(() => {
    if (!sections) return [];
    const nouvelles = sections.find((s) => s.key === "nouvelles");
    const rest = sections.filter((s) => s.key !== "nouvelles");
    const shuffled = shuffleArray(rest);
    return nouvelles ? [nouvelles, ...shuffled] : shuffled;
  }, [sections]);

  return (
    <>
      {/* Search bar — tappable redirect to library */}
      <div className="px-4 pb-4">
        <Link
          href="/library?search=true"
          className="relative flex h-11 w-full items-center rounded-xl border border-input bg-surface pl-10 pr-4 text-base text-muted-foreground"
          style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)" }}
        >
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <span>{t.search.placeholder}</span>
        </Link>
      </div>

      {/* Loading state (first visit only, no cached data yet) */}
      {isLoading && !sections ? (
        <div className="flex flex-col gap-6">
          <CarouselSkeleton />
          <CarouselSkeleton />
        </div>
      ) : !hasRecipes ? (
        <div className="mx-auto mt-16 max-w-xs px-4 text-center">
          <p className="text-lg font-medium text-foreground">
            {t.empty.libraryTitle}
          </p>
          <p className="mt-2 text-muted-foreground">{t.empty.libraryBody}</p>
          <Link
            href="/recipes/new"
            className="mt-6 inline-flex min-h-[44px] items-center rounded-lg px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--btn-gradient)", boxShadow: "var(--btn-shadow)" }}
          >
            {t.actions.addRecipe}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {orderedSections.map(({ key, title, recipes }) => (
            <RecipeCarousel key={key} title={title} recipes={recipes} />
          ))}
        </div>
      )}
    </>
  );
}
