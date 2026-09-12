"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import useSWR from "swr";
import { useT } from "@/lib/i18n/client";
import { Skeleton } from "@/components/ui/skeleton";
import RecipeCarousel from "./RecipeCarousel";
import EmptyLibraryState from "./EmptyLibraryState";
import LoadErrorState from "./LoadErrorState";
import { prepareForDisplay } from "@/lib/carousels/display";
import { swrFetcher } from "@/lib/swr";
import type { CarouselSection } from "@/lib/carousels/types";

// Poll while any recipe is still enriching (metadata or AI image) so the
// generated image and the "time · cost" subtitle appear in place, without the
// user having to leave and reopen the page. 0 disables SWR polling entirely.
const ENRICHMENT_POLL_INTERVAL = 4000;

function hasPendingEnrichment(sections?: CarouselSection[]): boolean {
  return !!sections?.some((section) =>
    section.recipes.some(
      (r) => r.enrichmentStatus === "pending" || r.imageStatus === "pending",
    ),
  );
}

function CarouselCardSkeleton() {
  return (
    <div
      className="card-surface w-[62vw] flex-none lg:w-65"
    >
      <Skeleton className="aspect-3/2 w-full rounded-none" />
      <div className="px-3 py-2.5">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-1.5 h-3 w-1/2" />
      </div>
    </div>
  );
}

function CarouselSkeleton() {
  return (
    <div>
      <Skeleton className="mb-3 ml-4 h-5 w-32" />
      <div className="flex gap-3 overflow-hidden px-4">
        <CarouselCardSkeleton />
        <CarouselCardSkeleton />
      </div>
    </div>
  );
}

export default function HomeContent({ isGuest = false }: { isGuest?: boolean }) {
  const t = useT();
  const [pollInterval, setPollInterval] = useState(0);
  const { data: sections, isLoading, error, mutate } = useSWR<CarouselSection[]>(
    "/api/carousels",
    swrFetcher,
    {
      revalidateOnMount: true,
      // A plain number (not the function form): SWR re-arms its polling timer
      // whenever this value flips 0 ↔ 4000, which is exactly when a pending
      // recipe appears in / disappears from the data.
      refreshInterval: pollInterval,
      // Must sit below refreshInterval, or the global 10s dedupingInterval
      // (SWRProvider) swallows 2 polls out of 3 and the image takes ~12s
      // instead of ~4s to show up.
      dedupingInterval: 3000,
      onSuccess: (data) =>
        setPollInterval(hasPendingEnrichment(data) ? ENRICHMENT_POLL_INTERVAL : 0),
    },
  );

  const hasRecipes = sections && sections.length > 0;

  // One seed per mount: the order is re-randomized on every visit, but stays
  // stable while enrichment polling refreshes the data every few seconds —
  // prepareForDisplay is deterministic for a given seed, and each section's
  // rank is independent, so a section appearing mid-poll (e.g. first recipe
  // of a new category) doesn't reshuffle the others.
  const [seed] = useState(() => Math.floor(Math.random() * 0xffffffff));

  const orderedSections = useMemo(
    () => (sections ? prepareForDisplay(sections, seed) : []),
    [sections, seed],
  );

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

      {/* Loading state (first visit only, no cached data yet) */}
      {isLoading && !sections ? (
        <div className="flex flex-col gap-6">
          <CarouselSkeleton />
          <CarouselSkeleton />
        </div>
      ) : error && !sections ? (
        // Failed load with no cached data: offline/server error, NOT an empty
        // library — with cached data, the stale sections render below instead.
        <LoadErrorState onRetry={() => mutate()} />
      ) : !hasRecipes ? (
        <EmptyLibraryState isGuest={isGuest} />
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
