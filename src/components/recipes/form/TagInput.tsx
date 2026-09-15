"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import useSWR from "swr";
import { useT } from "@/lib/i18n/client";
import { tagLabel } from "@/lib/i18n/labels";
import { swrFetcher } from "@/lib/swr";
import { apiRequest } from "@/lib/api-client";
import Chip from "@/components/recipes/Chip";
import TagListbox from "@/components/recipes/form/TagListbox";
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
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

interface TagInputProps {
  selectedTags: Tag[];
  onAdd: (tag: Tag) => void;
  onRemove: (tagId: string) => void;
}

export default function TagInput({ selectedTags, onAdd, onRemove }: TagInputProps) {
  const t = useT();
  // Catalogue des tags via SWR (même cache persistant que les deux listes) :
  // une erreur réseau remonte dans `error` au lieu d'être avalée, et un tag
  // créé est ajouté au cache sans refetch.
  const {
    data: tagsData,
    error: tagsError,
    mutate: mutateTags,
  } = useSWR<{ tags: Tag[] }>("/api/tags", swrFetcher);
  const allTags = tagsData?.tags ?? [];
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter available tags
  const selectedIds = new Set(selectedTags.map((t) => t.id));
  const normalizedQuery = normalize(query);

  const filtered = allTags.filter(
    (tag) =>
      !selectedIds.has(tag.id) &&
      (normalize(tag.name).includes(normalizedQuery) ||
        normalize(tagLabel(t, tag.name)).includes(normalizedQuery)),
  );

  // Group by category — clé de groupe = valeur stockée (FR canonique) ; les
  // tags sans catégorie vont dans le groupe de repli « Autres », traduit à
  // l'affichage par tagCategoryLabel.
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
    (tag) =>
      normalize(tag.name) === normalizedQuery ||
      normalize(tagLabel(t, tag.name)) === normalizedQuery,
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
    [onAdd],
  );

  const createTag = useCallback(async () => {
    if (isCreating || !query.trim()) return;
    setIsCreating(true);
    try {
      const tag = await apiRequest<Tag>("/api/tags", {
        body: { name: query.trim() },
        fallbackError: t.tags.createError,
      });
      if (!tag?.id) throw new Error(t.tags.createError);
      // Le serveur renvoie le tag existant (200) ou le nouveau (201) : dans
      // les deux cas on l'ajoute au cache s'il n'y est pas déjà.
      void mutateTags(
        (current) =>
          current && !current.tags.some((x) => x.id === tag.id)
            ? { tags: [...current.tags, tag] }
            : current,
        { revalidate: false },
      );
      selectTag(tag);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t.tags.createError);
    } finally {
      setIsCreating(false);
    }
  }, [query, isCreating, selectTag, mutateTags, t]);

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

  const activeDescendant = activeIndex >= 0 ? `tag-option-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className="relative" data-track="recipe.add_tag">
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <Chip
              key={tag.id}
              label={tagLabel(t, tag.name)}
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
        placeholder={t.tags.addPlaceholder}
        autoComplete="off"
        className="h-12 w-full rounded-[10px] border border-border bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {/* Erreur de chargement du catalogue : on peut encore créer un tag. */}
      {(tagsError || createError) && (
        <p className="mt-1.5 text-xs text-destructive" role="alert">
          {createError ?? t.tags.loadError}
        </p>
      )}

      {/* Dropdown */}
      {isOpen && flatItems.length > 0 && (
        <TagListbox
          ref={listboxRef}
          groups={sortedGroups}
          activeIndex={activeIndex}
          createLabel={showCreateOption ? t.tags.create(query.trim()) : null}
          onSelect={selectTag}
          onCreate={createTag}
          onHover={setActiveIndex}
        />
      )}
    </div>
  );
}
