"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { t } from "@/lib/i18n/fr";
import { useRecipeSearch } from "@/hooks/useRecipeSearch";
import RecipeCarousel from "./RecipeCarousel";
import RecipeCard from "./RecipeCard";
import type { RecipeListItem } from "@/types/recipe";

interface Carousel {
  key: string;
  title: string;
  recipes: RecipeListItem[];
}

interface HomeContentProps {
  recipes: RecipeListItem[];
  carousels: Carousel[];
}

export default function HomeContent({ recipes, carousels }: HomeContentProps) {
  const [query, setQuery] = useState("");
  const results = useRecipeSearch(recipes, query);
  const isSearching = query.trim().length > 0;

  return (
    <>
      {/* Search bar — always visible */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
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

      {/* Search results */}
      {isSearching ? (
        results.length === 0 ? (
          <div className="mx-auto mt-12 max-w-xs px-4 text-center">
            <p className="text-lg font-medium text-foreground">
              {t.empty.searchTitle}
            </p>
            <p className="mt-2 text-muted-foreground">{t.empty.searchBody}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-4 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} variant="grid" />
            ))}
          </div>
        )
      ) : (
        /* Carousels */
        carousels.length === 0 ? (
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
            {carousels.map(({ key, title, recipes: carouselRecipes }) => (
              <RecipeCarousel key={key} title={title} recipes={carouselRecipes} />
            ))}
          </div>
        )
      )}
    </>
  );
}
