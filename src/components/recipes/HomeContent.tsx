"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import useSWR from "swr";
import { t } from "@/lib/i18n/fr";
import { Skeleton } from "@/components/ui/skeleton";
import RecipeCarousel from "./RecipeCarousel";
import CocotteIllustration from "./CocotteIllustration";
import { prepareForDisplay } from "@/lib/carousels/display";
import type { CarouselSection } from "@/lib/carousels/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
      className="w-[62vw] flex-none overflow-hidden rounded-xl border border-border/40 lg:w-65"
      style={{
        background: "var(--card-gradient)",
        boxShadow: "var(--card-shadow-sm)",
        borderBottom: "1px solid var(--card-border-accent)",
      }}
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

export default function HomeContent() {
  const [pollInterval, setPollInterval] = useState(0);
  const { data: sections, isLoading } = useSWR<CarouselSection[]>(
    "/api/carousels",
    fetcher,
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
      ) : !hasRecipes ? (
        <div className="mx-auto mt-16 max-w-xs px-4 text-center">
          <div className="mb-5 flex justify-center">
            <CocotteIllustration size={72} accent="var(--accent)" />
          </div>
          <p
            className="text-foreground"
            style={{
              fontFamily: "var(--font-fraunces)",
              fontVariationSettings: '"opsz" 144',
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: 22,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
            }}
          >
            {t.empty.libraryTitle}
          </p>
          <p className="mt-2 text-muted-foreground">{t.empty.libraryBody}</p>
          <Link
            href="/recipes/new"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
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
