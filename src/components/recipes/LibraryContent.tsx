"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { t } from "@/lib/i18n/fr";
import { useRecipeSearch } from "@/hooks/useRecipeSearch";
import FilterBar from "./FilterBar";
import RecipeCard from "./RecipeCard";
import type { LibraryRecipeItem, Tag } from "@/types/recipe";
import type { FilterState } from "@/lib/filters";
import { matchesFilters } from "@/lib/filters";

interface LibraryContentProps {
  recipes: LibraryRecipeItem[];
  tags: Tag[];
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
  recipes,
  tags,
  autoFocusSearch = false,
}: LibraryContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(() =>
    parseFiltersFromParams(searchParams),
  );

  const searchResults = useRecipeSearch(recipes, query);
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
    const base = isSearching ? searchResults : recipes;
    if (!hasActiveFilters) return base;
    return base.filter((recipe) => matchesFilters(recipe, filters, tags));
  }, [isSearching, searchResults, recipes, hasActiveFilters, filters, tags]);

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
        tags={tags}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Recipe grid */}
      {displayedRecipes.length === 0 ? (
        recipes.length === 0 ? (
          <div className="mx-auto mt-16 max-w-xs text-center">
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
          <div className="mx-auto mt-12 max-w-xs px-4 text-center">
            <p className="text-lg font-medium text-foreground">
              {isSearching ? t.empty.searchTitle : t.filters.noResults}
            </p>
            <p className="mt-2 text-muted-foreground">
              {isSearching ? t.empty.searchBody : ""}
            </p>
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
