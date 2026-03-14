"use client";

import Image from "next/image";
import { Camera, RefreshCw } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { t } from "@/lib/i18n/fr";

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

  // Image display priority: previewFile > photoUrl > generatedUrl > placeholder
  const displaySrc = previewUrl ?? currentPhotoUrl ?? currentGeneratedUrl;
  const hasPhoto = !!displaySrc;
  const showRegenerate = !!currentGeneratedUrl || regenerateRequested;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onReplace(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        Photo{" "}
        <span className="font-normal text-muted-foreground">
          {t.form.photoOptional}
        </span>
      </label>

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
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium min-h-[44px] flex-1 justify-center transition-colors ${
                  regenerateRequested
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-white/85 backdrop-blur-sm text-foreground"
                }`}
              >
                <RefreshCw size={14} aria-hidden="true" />
                {regenerateRequested ? t.photoManager.regenerateScheduled : t.photoManager.regenerate}
              </button>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label={t.photoManager.replaceAriaLabel}
              className="flex-1 rounded-lg bg-white/85 backdrop-blur-sm px-3 py-2 text-xs font-medium min-h-[44px] text-foreground"
            >
              {t.photoManager.replace}
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={t.photoManager.removeAriaLabel}
              className="flex-1 rounded-lg bg-white/85 backdrop-blur-sm px-3 py-2 text-xs font-medium min-h-[44px] text-destructive"
            >
              {t.photoManager.remove}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[4/3] w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/50 transition-colors hover:bg-secondary"
          aria-label={t.actions.addPhoto}
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Camera size={32} aria-hidden="true" />
            <span className="text-sm font-medium">{t.actions.addPhoto}</span>
          </div>
        </button>
      )}
    </div>
  );
}
