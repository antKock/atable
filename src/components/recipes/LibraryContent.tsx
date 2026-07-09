"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { t } from "@/lib/i18n/fr";
import { useRecipeSearch } from "@/hooks/useRecipeSearch";
import { Skeleton } from "@/components/ui/skeleton";
import FilterBar from "./FilterBar";
import RecipeCard from "./RecipeCard";
import CocotteIllustration from "./CocotteIllustration";
import LoadErrorState from "./LoadErrorState";
import { swrFetcher } from "@/lib/swr";
import type { LibraryRecipeItem, Tag } from "@/types/recipe";
import type { FilterState } from "@/lib/filters";
import { matchesFilters } from "@/lib/filters";

interface LibraryContentProps {
  autoFocusSearch?: boolean;
}

const VALID_DURATIONS = new Set(["lt30", "30to60", "gt60"]);
const VALID_COSTS = new Set(["€", "€€", "€€€"]);

function parseFiltersFromParams(params: URLSearchParams): FilterState {
  const duration = params.get("duration");
  const cost = params.get("cost");
  return {
    season: params.get("season") === "1",
    tagIds: params.get("tags")?.split(",").filter(Boolean) ?? [],
    duration: duration && VALID_DURATIONS.has(duration) ? (duration as FilterState["duration"]) : null,
    cost: cost && VALID_COSTS.has(cost) ? (cost as FilterState["cost"]) : null,
  };
}

function filtersToParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.season) params.set("season", "1");
  if (filters.tagIds.length > 0) params.set("tags", filters.tagIds.join(","));
  if (filters.duration) params.set("duration", filters.duration);
  if (filters.cost) params.set("cost", filters.cost);
  return params;
}

export default function LibraryContent({
  autoFocusSearch = false,
}: LibraryContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: libraryData, isLoading, error, mutate } = useSWR<{ recipes: LibraryRecipeItem[]; tags: Tag[] }>(
    "/api/library",
    swrFetcher,
    { revalidateOnMount: true },
  );

  const liveRecipes = useMemo(
    () => libraryData?.recipes ?? [],
    [libraryData?.recipes],
  );
  const liveTags = useMemo(
    () => libraryData?.tags ?? [],
    [libraryData?.tags],
  );

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(() =>
    parseFiltersFromParams(searchParams),
  );

  const searchResults = useRecipeSearch(liveRecipes, query);
  const isSearching = query.trim().length > 0;

  // Auto-focus search input when redirected from home
  useEffect(() => {
    if (autoFocusSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [autoFocusSearch]);

  // Sync filter changes to URL
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    const params = filtersToParams(newFilters);
    const queryString = params.toString();
    router.replace(queryString ? `/library?${queryString}` : "/library", {
      scroll: false,
    });
  };

  const hasActiveFilters =
    filters.season ||
    filters.tagIds.length > 0 ||
    filters.duration !== null ||
    filters.cost !== null;

  // Apply filters to recipes (search results or all recipes)
  const displayedRecipes = useMemo(() => {
    const base = isSearching ? searchResults : liveRecipes;
    if (!hasActiveFilters) return base;
    return base.filter((recipe) => matchesFilters(recipe, filters, liveTags));
  }, [isSearching, searchResults, liveRecipes, hasActiveFilters, filters, liveTags]);

  // Loading state (first visit only, no cached data yet)
  if (isLoading && !libraryData) {
    return (
      <>
        <div className="px-4 pb-3">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <div className="flex gap-2 px-3 pb-3">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 px-4 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-border/40"
              style={{
                background: "var(--card-gradient)",
                boxShadow: "var(--card-shadow-sm)",
                borderBottom: "1px solid var(--card-border-accent)",
              }}
            >
              <Skeleton className="aspect-3/4 w-full rounded-none" />
              <div className="px-3 py-2.5">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="mt-1.5 h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  // Failed load with no cached data: offline/server error, NOT an empty
  // library — with cached data, the stale list renders below instead.
  if (error && !libraryData) {
    return <LoadErrorState onRetry={() => mutate()} />;
  }

  return (
    <>
      {/* Search bar */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search.placeholder}
            aria-label={t.search.ariaLabel}
            autoFocus={autoFocusSearch}
            className="h-11 w-full rounded-xl border border-input bg-surface pl-10 pr-10 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {isSearching && (
            <button
              onClick={() => setQuery("")}
              aria-label={t.search.clearAriaLabel}
              className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        tags={liveTags}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Recipe grid */}
      {displayedRecipes.length === 0 ? (
        liveRecipes.length === 0 ? (
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
          <div className="mx-auto mt-12 max-w-xs px-4 text-center">
            <div className="mb-4 flex justify-center" style={{ opacity: 0.6 }}>
              <CocotteIllustration size={56} accent="var(--accent)" />
            </div>
            <p
              className="text-foreground"
              style={{
                fontFamily: "var(--font-fraunces)",
                fontVariationSettings: '"opsz" 144',
                fontStyle: "italic",
                fontWeight: 500,
                fontSize: 20,
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
              }}
            >
              {isSearching ? t.empty.searchTitle : t.filters.noResults}
            </p>
            {isSearching && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t.empty.searchBody}
              </p>
            )}
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 lg:grid-cols-3 xl:grid-cols-4">
          {displayedRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} variant="grid" />
          ))}
        </div>
      )}
    </>
  );
}
