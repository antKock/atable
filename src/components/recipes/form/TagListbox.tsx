"use client";

import type { Ref } from "react";
import { useT } from "@/lib/i18n/client";
import { tagCategoryLabel, tagLabel } from "@/lib/i18n/labels";
import type { Tag } from "@/types/recipe";

type Props = {
  ref: Ref<HTMLUListElement>;
  /** Groupes (catégorie stockée → tags), déjà filtrés et ordonnés. */
  groups: [string, Tag[]][];
  /** Index actif dans la liste aplatie (tags dans l'ordre des groupes, puis « créer »). */
  activeIndex: number;
  /** Libellé de l'option « Créer ‘…’ », ou null si absente. */
  createLabel: string | null;
  onSelect: (tag: Tag) => void;
  onCreate: () => void;
  onHover: (index: number) => void;
};

function CheckIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ visibility: visible ? "visible" : "hidden" }}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function optionClass(active: boolean, extra = ""): string {
  return `flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${extra} ${
    active ? "font-medium text-foreground" : "text-foreground hover:bg-secondary"
  }`;
}

/**
 * Liste déroulante du combobox de tags (revue 2026-09-12 : sortie de
 * TagInput, où une IIFE à index mutable la rendait). Les index d'options sont
 * calculés à plat : chaque groupe démarre à la somme des tailles précédentes,
 * l'option « créer » vient en dernier — même numérotation que la navigation
 * clavier de TagInput (`flatItems`).
 */
export default function TagListbox({ ref, groups, activeIndex, createLabel, onSelect, onCreate, onHover }: Props) {
  const t = useT();
  const offsets: number[] = [];
  let total = 0;
  for (const [, tags] of groups) {
    offsets.push(total);
    total += tags.length;
  }
  const createIndex = total;

  return (
    <ul
      ref={ref}
      id="tag-listbox"
      role="listbox"
      className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-background shadow-lg"
    >
      {groups.map(([category, tags], g) => (
        <li key={category} role="group" aria-label={tagCategoryLabel(t, category)}>
          <div className="display-italic px-3 pt-2 pb-1" style={{ fontSize: 12, color: "var(--accent)" }}>
            {tagCategoryLabel(t, category)}
          </div>
          <ul role="group">
            {tags.map((tag, i) => {
              const idx = offsets[g] + i;
              const isActive = idx === activeIndex;
              return (
                <li
                  key={tag.id}
                  id={`tag-option-${idx}`}
                  data-index={idx}
                  role="option"
                  aria-selected={false}
                  className={optionClass(isActive)}
                  style={{ background: isActive ? "var(--chip-bg-selected)" : undefined }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(tag);
                  }}
                  onMouseEnter={() => onHover(idx)}
                >
                  <CheckIcon visible={isActive} />
                  {tagLabel(t, tag.name)}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
      {createLabel !== null && (
        <li
          id={`tag-option-${createIndex}`}
          data-index={createIndex}
          role="option"
          aria-selected={false}
          className={optionClass(createIndex === activeIndex, "border-t border-border")}
          style={{ background: createIndex === activeIndex ? "var(--chip-bg-selected)" : undefined }}
          onMouseDown={(e) => {
            e.preventDefault();
            onCreate();
          }}
          onMouseEnter={() => onHover(createIndex)}
        >
          <CheckIcon visible={createIndex === activeIndex} />
          {createLabel}
        </li>
      )}
    </ul>
  );
}
