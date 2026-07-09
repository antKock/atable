"use client";

import { useState, useRef, useEffect } from "react";
import { Link2, ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n/fr";
import ImportCard from "./ImportCard";

interface UrlImporterProps {
  expanded: boolean;
  onToggle: () => void;
  error: string | null;
  onSubmit: (url: string) => void;
  /** Pre-fills the input — e.g. the shared URL, so a failed auto-import (share
   *  sheet) can be retried in one tap without re-sharing. */
  initialUrl?: string;
}

export default function UrlImporter({
  expanded,
  onToggle,
  error,
  onSubmit,
  initialUrl,
}: UrlImporterProps) {
  const [urlValue, setUrlValue] = useState(initialUrl ?? "");
  const urlInputRef = useRef<HTMLInputElement>(null);

  // F9: Focus URL input when card expands
  useEffect(() => {
    if (expanded) {
      urlInputRef.current?.focus();
    }
  }, [expanded]);

  function handleSubmit() {
    if (!urlValue.trim()) return;
    onSubmit(urlValue.trim());
  }

  return (
    <ImportCard
      icon={Link2}
      title={t.import.url.title}
      description={t.import.url.description}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="flex items-center gap-2.5">
        <input
          ref={urlInputRef}
          type="url"
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={t.import.url.placeholder}
          className="h-11 flex-1 rounded-xl border-[1.5px] border-border bg-background px-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-accent focus:shadow-[0_0_0_3px_rgba(110,122,56,0.15)]"
        />
        <button
          type="button"
          onClick={handleSubmit}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity hover:opacity-85"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </ImportCard>
  );
}
