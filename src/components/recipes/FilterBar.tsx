"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { t } from "@/lib/i18n/fr";
import type { Tag } from "@/types/recipe";
import type { FilterState } from "@/lib/filters";
import {
  FILTER_CATEGORIES,
  DURATION_OPTIONS,
  COST_OPTIONS,
} from "@/lib/filters";

interface FilterBarProps {
  tags: Tag[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export default function FilterBar({
  tags,
  filters,
  onFiltersChange,
}: FilterBarProps) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const toggleSeason = () => {
    onFiltersChange({ ...filters, season: !filters.season });
  };

  const toggleCategory = (key: string) => {
    setOpenCategory(openCategory === key ? null : key);
  };

  const isCategoryActive = (key: string) => {
    if (key === "duration") return filters.duration !== null;
    if (key === "cost") return filters.cost !== null;
    // Tag category: check if any selected tag belongs to this DB category
    const dbCategory = FILTER_CATEGORIES.find((c) => c.key === key)?.dbCategory;
    if (!dbCategory) return false;
    return tags
      .filter((tag) => tag.category === dbCategory)
      .some((tag) => filters.tagIds.includes(tag.id));
  };

  const toggleTag = (tagId: string) => {
    const tagIds = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter((id) => id !== tagId)
      : [...filters.tagIds, tagId];
    onFiltersChange({ ...filters, tagIds });
  };

  const toggleDuration = (id: string) => {
    onFiltersChange({
      ...filters,
      duration: filters.duration === id ? null : id,
    });
  };

  const toggleCost = (id: string) => {
    onFiltersChange({
      ...filters,
      cost: filters.cost === id ? null : id,
    });
  };

  const categoryLabels: Record<string, string> = {
    "Type de plat": t.filters.typeDePlat,
    Cuisine: t.filters.cuisine,
    Régime: t.filters.regime,
    duration: t.filters.duree,
    cost: t.filters.cout,
  };

  const allCategories = [
    ...FILTER_CATEGORIES.map((c) => c.key),
    "duration",
    "cost",
  ];

  return (
    <div>
      {/* Pill row */}
      <div className="flex gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* De saison toggle */}
        <button
          type="button"
          aria-pressed={filters.season}
          onClick={toggleSeason}
          className={`flex h-8 flex-none items-center rounded-full px-3 text-[13px] font-medium transition-colors ${
            filters.season
              ? "bg-accent text-accent-foreground"
              : "border border-border bg-background text-foreground"
          }`}
        >
          {t.filters.deSaison}
        </button>

        {/* Category pills */}
        {allCategories.map((key) => {
          const active = isCategoryActive(key);
          const expanded = openCategory === key;
          return (
            <button
              key={key}
              type="button"
              aria-expanded={expanded}
              onClick={() => toggleCategory(key)}
              className={`flex h-8 flex-none items-center gap-1 rounded-full px-3 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "border border-border bg-background text-foreground"
              }`}
            >
              {categoryLabels[key]}
              <ChevronDown
                className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          );
        })}
      </div>

      {/* Dropdown panel */}
      {openCategory && (
        <div className="mx-3 mb-3 rounded-lg border border-border bg-background p-3">
          <div className="flex flex-wrap gap-2">
            {openCategory === "duration" ? (
              DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleDuration(opt.id)}
                  className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                    filters.duration === opt.id
                      ? "bg-accent font-semibold text-accent-foreground"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))
            ) : openCategory === "cost" ? (
              COST_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleCost(opt.id)}
                  className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                    filters.cost === opt.id
                      ? "bg-accent font-semibold text-accent-foreground"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))
            ) : (
              tags
                .filter((tag) => {
                  const dbCategory = FILTER_CATEGORIES.find(
                    (c) => c.key === openCategory,
                  )?.dbCategory;
                  return tag.category === dbCategory;
                })
                .map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                      filters.tagIds.includes(tag.id)
                        ? "bg-accent font-semibold text-accent-foreground"
                        : "border border-border text-muted-foreground"
                    }`}
                  >
                    {tag.name}
                  </button>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
