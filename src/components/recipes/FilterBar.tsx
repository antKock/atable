"use client";

import { ChevronDown, Check } from "lucide-react";
import { Popover } from "radix-ui";
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
  const toggleSeason = () => {
    onFiltersChange({ ...filters, season: !filters.season });
  };

  const countSelected = (key: string): number => {
    if (key === "duration") return filters.duration ? 1 : 0;
    if (key === "cost") return filters.cost ? 1 : 0;
    const dbCategory = FILTER_CATEGORIES.find((c) => c.key === key)?.dbCategory;
    if (!dbCategory) return 0;
    return tags.filter(
      (tag) => tag.category === dbCategory && filters.tagIds.includes(tag.id),
    ).length;
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

  const optionButtonClass =
    "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors";

  function renderPanel(key: string) {
    if (key === "duration") {
      return DURATION_OPTIONS.map((opt) => {
        const selected = filters.duration === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggleDuration(opt.id)}
            className={optionButtonClass}
            style={{
              background: selected
                ? "var(--chip-bg-selected)"
                : "transparent",
              color: selected ? "var(--chip-text-selected)" : "var(--foreground)",
              border: selected
                ? "1px solid transparent"
                : "1px solid var(--border)",
            }}
          >
            {selected && <Check size={12} strokeWidth={2.5} />}
            {opt.label}
          </button>
        );
      });
    }
    if (key === "cost") {
      return COST_OPTIONS.map((opt) => {
        const selected = filters.cost === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggleCost(opt.id)}
            className={optionButtonClass}
            style={{
              background: selected
                ? "var(--chip-bg-selected)"
                : "transparent",
              color: selected ? "var(--chip-text-selected)" : "var(--foreground)",
              border: selected
                ? "1px solid transparent"
                : "1px solid var(--border)",
            }}
          >
            {selected && <Check size={12} strokeWidth={2.5} />}
            {opt.label}
          </button>
        );
      });
    }
    const dbCategory = FILTER_CATEGORIES.find((c) => c.key === key)?.dbCategory;
    return tags
      .filter((tag) => tag.category === dbCategory)
      .map((tag) => {
        const selected = filters.tagIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggleTag(tag.id)}
            className={optionButtonClass}
            style={{
              background: selected
                ? "var(--chip-bg-selected)"
                : "transparent",
              color: selected ? "var(--chip-text-selected)" : "var(--foreground)",
              border: selected
                ? "1px solid transparent"
                : "1px solid var(--border)",
            }}
          >
            {selected && <Check size={12} strokeWidth={2.5} />}
            {tag.name}
          </button>
        );
      });
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        {allCategories.map((key) => {
          const count = countSelected(key);
          const active = count > 0;
          return (
            <Popover.Root key={key}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={`flex h-8 flex-none items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${
                    active
                      ? "border border-transparent bg-accent/10 text-accent"
                      : "border border-border bg-background text-foreground"
                  }`}
                >
                  {categoryLabels[key]}
                  {count > 0 && (
                    <span
                      className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold leading-none text-white"
                      style={{
                        minWidth: 18,
                        height: 18,
                        padding: "0 5px",
                        background: "var(--accent)",
                      }}
                    >
                      {count}
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  sideOffset={8}
                  align="start"
                  collisionPadding={12}
                  className="z-50 max-w-[calc(100vw-24px)] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none"
                >
                  <div className="flex flex-wrap gap-2">{renderPanel(key)}</div>
                  <Popover.Arrow
                    width={12}
                    height={6}
                    style={{ fill: "var(--popover)" }}
                  />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          );
        })}
      </div>
    </div>
  );
}
