"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { t } from "@/lib/i18n/fr";
import TagChip from "./TagChip";
import type { Tag } from "@/types/recipe";

const CATEGORY_ORDER = [
  "Type de plat",
  "Régime alimentaire",
  "Protéine principale",
  "Cuisine",
  "Occasion",
  "Caractéristiques",
];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface TagInputProps {
  selectedTags: Tag[];
  onAdd: (tag: Tag) => void;
  onRemove: (tagId: string) => void;
}

export default function TagInput({ selectedTags, onAdd, onRemove }: TagInputProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isCreating, setIsCreating] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch all tags on mount
  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => setAllTags(data.tags ?? []))
      .catch(() => {});
  }, []);

  // Filter available tags
  const selectedIds = new Set(selectedTags.map((t) => t.id));
  const normalizedQuery = normalize(query);

  const filtered = allTags.filter(
    (tag) => !selectedIds.has(tag.id) && normalize(tag.name).includes(normalizedQuery)
  );

  // Group by category
  const grouped = new Map<string, Tag[]>();
  for (const tag of filtered) {
    const cat = tag.category ?? "Autres";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(tag);
  }

  // Sort groups by CATEGORY_ORDER
  const sortedGroups: [string, Tag[]][] = [];
  for (const cat of CATEGORY_ORDER) {
    if (grouped.has(cat)) {
      sortedGroups.push([cat, grouped.get(cat)!]);
      grouped.delete(cat);
    }
  }
  // "Autres" and any remaining categories at the end
  for (const [cat, tags] of grouped) {
    sortedGroups.push([cat, tags]);
  }

  // Flat list for keyboard nav
  const flatItems: (Tag | "create")[] = [];
  for (const [, tags] of sortedGroups) {
    flatItems.push(...tags);
  }

  const hasExactMatch = allTags.some(
    (tag) => normalize(tag.name) === normalizedQuery
  );
  const showCreateOption = query.trim().length > 0 && !hasExactMatch;
  if (showCreateOption) {
    flatItems.push("create");
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectTag = useCallback(
    (tag: Tag) => {
      onAdd(tag);
      setQuery("");
      setActiveIndex(-1);
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [onAdd]
  );

  const createTag = useCallback(async () => {
    if (isCreating || !query.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: query.trim() }),
      });
      if (res.ok) {
        const tag: Tag = await res.json();
        setAllTags((prev) => [...prev, tag]);
        selectTag(tag);
      }
    } finally {
      setIsCreating(false);
    }
  }, [query, isCreating, selectTag]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < flatItems.length) {
          const item = flatItems[activeIndex];
          if (item === "create") {
            createTag();
          } else {
            selectTag(item);
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listboxRef.current) {
      const item = listboxRef.current.querySelector(`[data-index="${activeIndex}"]`);
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const activeDescendant =
    activeIndex >= 0 ? `tag-option-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className="relative">
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <TagChip
              key={tag.id}
              name={tag.name}
              editable
              onRemove={() => onRemove(tag.id)}
            />
          ))}
        </div>
      )}

      {/* Combobox input */}
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="tag-listbox"
        aria-activedescendant={activeDescendant}
        aria-autocomplete="list"
        aria-label={t.form.tagsLabel}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          if (query || allTags.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Ajouter un tag…"
        autoComplete="off"
        className="h-12 w-full rounded-md border border-border bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
      />

      {/* Dropdown */}
      {isOpen && (flatItems.length > 0) && (
        <ul
          ref={listboxRef}
          id="tag-listbox"
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-background shadow-lg"
        >
          {(() => {
            let itemIndex = 0;
            return (
              <>
                {sortedGroups.map(([category, tags]) => (
                  <li key={category} role="group" aria-label={category}>
                    <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {category}
                    </div>
                    <ul role="group">
                      {tags.map((tag) => {
                        const idx = itemIndex++;
                        return (
                          <li
                            key={tag.id}
                            id={`tag-option-${idx}`}
                            data-index={idx}
                            role="option"
                            aria-selected={idx === activeIndex}
                            className={`cursor-pointer px-3 py-2 text-sm ${
                              idx === activeIndex
                                ? "bg-accent text-white"
                                : "text-foreground hover:bg-secondary"
                            }`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectTag(tag);
                            }}
                            onMouseEnter={() => setActiveIndex(idx)}
                          >
                            {tag.name}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
                {showCreateOption && (
                  <li
                    id={`tag-option-${itemIndex}`}
                    data-index={itemIndex}
                    role="option"
                    aria-selected={itemIndex === activeIndex}
                    className={`cursor-pointer border-t border-border px-3 py-2 text-sm ${
                      itemIndex === activeIndex
                        ? "bg-accent text-white"
                        : "text-foreground hover:bg-secondary"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      createTag();
                    }}
                    onMouseEnter={() => setActiveIndex(itemIndex)}
                  >
                    Créer &lsquo;{query.trim()}&rsquo;
                  </li>
                )}
              </>
            );
          })()}
        </ul>
      )}
    </div>
  );
}
