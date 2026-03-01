"use client";

import Image from "next/image";
import { Camera } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/fr";

interface PhotoPickerProps {
  /** Public URL of an already-saved photo (from DB) */
  currentUrl?: string | null;
  /** Newly selected file (not yet uploaded) */
  previewFile?: File | null;
  /** Whether the user has chosen to remove the current photo */
  removed?: boolean;
  onChange: (file: File) => void;
  onRemove: () => void;
}

export default function PhotoPicker({
  currentUrl,
  previewFile,
  removed,
  onChange,
  onRemove,
}: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Create / revoke blob URL when previewFile changes
  useEffect(() => {
    if (!previewFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

  const displaySrc = previewUrl ?? currentUrl;
  const hasPhoto = !removed && !!displaySrc;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        Photo{" "}
        <span className="font-normal text-muted-foreground">
          {t.form.photoOptional}
        </span>
      </label>

      {/* Hidden file input — accept any image, native picker on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onChange(file);
          // Reset so the same file can be re-selected
          e.target.value = "";
        }}
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="min-h-[44px] flex-1"
            >
              {t.actions.replacePhoto}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRemove}
              className="min-h-[44px] flex-1 text-destructive hover:text-destructive"
            >
              {t.actions.removePhoto}
            </Button>
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
