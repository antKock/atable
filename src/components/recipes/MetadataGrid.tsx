"use client";

import { t } from "@/lib/i18n/fr";
import ShimmerBlock from "./ShimmerBlock";

interface MetadataGridProps {
  prepTime: string | null;
  cookTime: string | null;
  cost: string | null;
  complexity: string | null;
  isLoading: boolean;
}

function MetadataValue({ value, isLoading }: { value: string | null; isLoading: boolean }) {
  if (isLoading) return <ShimmerBlock variant="rect" className="w-16" />;
  return (
    <span
      className="text-sm font-medium text-foreground transition-opacity"
      style={{ transitionDuration: "var(--reveal-duration)" }}
    >
      {value ?? "—"}
    </span>
  );
}

export default function MetadataGrid({
  prepTime,
  cookTime,
  cost,
  complexity,
  isLoading,
}: MetadataGridProps) {
  return (
    <div
      className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-4 gap-y-3 rounded-lg px-4 py-3"
      style={{
        background: "linear-gradient(168deg, #EEF2E4, #F5F3EE)",
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)",
      }}
      aria-live="polite"
    >
      <span className="text-xs font-medium text-muted-foreground">{t.metadata.prepTime}</span>
      <MetadataValue value={prepTime} isLoading={isLoading} />
      <span className="text-xs font-medium text-muted-foreground">{t.metadata.cookTime}</span>
      <MetadataValue value={cookTime} isLoading={isLoading} />
      <span className="text-xs font-medium text-muted-foreground">{t.metadata.cost}</span>
      <MetadataValue value={cost} isLoading={isLoading} />
      <span className="text-xs font-medium text-muted-foreground">{t.metadata.complexity}</span>
      <MetadataValue value={complexity} isLoading={isLoading} />
    </div>
  );
}
