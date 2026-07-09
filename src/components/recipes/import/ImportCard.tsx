"use client";

import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ImportCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

// Shared collapsible card shell for the three import modes (screenshot,
// voice, url). The expanded content is rendered by the caller.
export default function ImportCard({
  icon: Icon,
  title,
  description,
  expanded,
  onToggle,
  children,
}: ImportCardProps) {
  // The header is a real <button> (keyboard + screen-reader reachable); the
  // expanded content lives outside it — nesting inputs in a button is invalid.
  return (
    <div
      className={`flex flex-wrap items-center gap-4 rounded-[18px] border-[1.5px] bg-surface p-3.5 transition-all ${
        expanded
          ? "border-accent shadow-[0_2px_16px_rgba(110,122,56,0.12)]"
          : "border-border hover:border-accent hover:shadow-[0_2px_12px_rgba(110,122,56,0.10)] active:scale-[0.985]"
      }`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => !expanded && onToggle()}
        className={`flex min-w-0 flex-1 items-center gap-4 text-left ${
          expanded ? "cursor-default" : "cursor-pointer"
        }`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(110,122,56,0.12)]">
          <Icon size={20} className="text-accent" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{title}</h3>
          {expanded && (
            <p className="text-[13px] leading-tight text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <ChevronRight
          size={18}
          className={`shrink-0 text-muted-foreground opacity-50 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {expanded && <div className="mt-0.5 basis-full">{children}</div>}
    </div>
  );
}
