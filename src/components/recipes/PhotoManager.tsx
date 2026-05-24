"use client";

import Image from "next/image";
import { RefreshCw, Trash2 } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { t } from "@/lib/i18n/fr";
import CocotteIllustration from "./CocotteIllustration";

interface PhotoManagerProps {
  currentPhotoUrl: string | null;
  currentGeneratedUrl: string | null;
  previewFile: File | null;
  onRegenerate: () => void;
  onReplace: (file: File) => void;
  onRemove: () => void;
  regenerateRequested?: boolean;
}

export default function PhotoManager({
  currentPhotoUrl,
  currentGeneratedUrl,
  previewFile,
  onRegenerate,
  onReplace,
  onRemove,
  regenerateRequested = false,
}: PhotoManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!previewFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

  const displaySrc = previewUrl ?? currentPhotoUrl ?? currentGeneratedUrl;
  const hasPhoto = !!displaySrc;
  const showRegenerate = !!currentGeneratedUrl || regenerateRequested;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onReplace(file);
    e.target.value = "";
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={handleFileSelect}
      />

      {hasPhoto ? (
        <div className="flex flex-col gap-2">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-secondary">
            <Image
              src={displaySrc!}
              alt={t.a11y.recipePhoto("recette")}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 640px"
              unoptimized={!!previewUrl}
            />
          </div>
          <div className="flex gap-2">
            {showRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                aria-label={t.photoManager.regenerateAriaLabel}
                className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  regenerateRequested
                    ? "border-accent/30 bg-accent/10 text-accent"
                    : "border-border bg-surface text-foreground hover:bg-secondary"
                }`}
              >
                <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true" />
                {regenerateRequested
                  ? t.photoManager.regenerateScheduled
                  : t.photoManager.regenerate}
              </button>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label={t.photoManager.replaceAriaLabel}
              className="flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
            >
              {t.photoManager.replace}
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={t.photoManager.removeAriaLabel}
              className="flex min-h-[40px] w-10 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl border-none p-3.5 text-left transition-opacity hover:opacity-90"
          style={{
            background:
              "linear-gradient(155deg, rgba(110, 122, 56, 0.07), rgba(110, 122, 56, 0.02))",
          }}
          aria-label={t.actions.addPhoto}
        >
          <div className="flex-none">
            <CocotteIllustration size={40} accent="var(--accent)" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">
              {t.actions.addPhoto}
            </div>
            <div className="text-xs text-muted-foreground">
              ou Mijote en générera une
            </div>
          </div>
          <div className="flex-none text-2xl font-light text-muted-foreground">
            +
          </div>
        </button>
      )}
    </div>
  );
}
