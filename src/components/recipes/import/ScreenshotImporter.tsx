"use client";

import { useState, useRef, useEffect } from "react";
import NextImage from "next/image";
import { Image as ImageIcon, ChevronRight, Upload, Plus, X } from "lucide-react";
import { t } from "@/lib/i18n/fr";
import ImportCard from "./ImportCard";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface FileWithKey {
  file: File;
  key: string;
  previewUrl: string;
}

interface ScreenshotImporterProps {
  expanded: boolean;
  onToggle: () => void;
  error: string | null;
  onSubmit: (files: File[]) => void;
}

export default function ScreenshotImporter({
  expanded,
  onToggle,
  error,
  onSubmit,
}: ScreenshotImporterProps) {
  const [fileEntries, setFileEntries] = useState<FileWithKey[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // F4: Revoke object URLs on cleanup
  useEffect(() => {
    return () => {
      fileEntries.forEach((e) => URL.revokeObjectURL(e.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const imageFiles = Array.from(newFiles).filter(
      (f) => f.type.startsWith("image/") && f.size <= MAX_FILE_SIZE, // F12
    );
    if (imageFiles.length === 0) return;

    setFileEntries((prev) => {
      const combined = [...prev, ...imageFiles.map((f) => ({
        file: f,
        key: `${f.name}-${f.lastModified}-${f.size}`,
        previewUrl: URL.createObjectURL(f),
      }))].slice(0, 5);
      // F4: Revoke URLs from entries that got sliced off
      const kept = new Set(combined.map((e) => e.previewUrl));
      prev.forEach((e) => {
        if (!kept.has(e.previewUrl)) URL.revokeObjectURL(e.previewUrl);
      });
      return combined;
    });
  }

  function removeFile(key: string) {
    setFileEntries((prev) => {
      const removed = prev.find((e) => e.key === key);
      if (removed) URL.revokeObjectURL(removed.previewUrl); // F4
      return prev.filter((e) => e.key !== key);
    });
  }

  function handleSubmit() {
    if (fileEntries.length === 0) return;
    onSubmit(fileEntries.map((e) => e.file));
  }

  return (
    <ImportCard
      icon={ImageIcon}
      title={t.import.screenshot.title}
      description={t.import.screenshot.description}
      expanded={expanded}
      onToggle={onToggle}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={addMoreInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {fileEntries.length === 0 ? (
        <div
          className="cursor-pointer rounded-[14px] border-2 border-dashed border-border bg-background p-6 text-center transition-all hover:border-accent hover:bg-[rgba(110,122,56,0.12)]"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={32} className="mx-auto mb-2 text-accent" />
          <p className="text-sm font-medium">{t.import.screenshot.upload}</p>
          <span className="mt-1 block text-xs text-muted-foreground">
            {t.import.screenshot.uploadHint}
          </span>
        </div>
      ) : (
        <>
          {/* Preview grid */}
          <div className="mt-3 flex flex-wrap gap-2.5">
            {fileEntries.map((entry) => (
              <div
                key={entry.key} /* F14 */
                className="relative h-18 w-18 shrink-0 overflow-hidden rounded-[10px] border-[1.5px] border-border"
              >
                <NextImage
                  src={entry.previewUrl}
                  alt=""
                  fill
                  sizes="72px"
                  className="object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => removeFile(entry.key)}
                  className="absolute right-0.75 top-0.75 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            {fileEntries.length < 5 && (
              <button
                type="button"
                onClick={() => addMoreInputRef.current?.click()}
                className="flex h-18 w-18 shrink-0 items-center justify-center rounded-[10px] border-2 border-dashed border-border text-muted-foreground transition-all hover:border-accent hover:text-accent"
              >
                <Plus size={24} />
              </button>
            )}
          </div>

          {/* Submit row */}
          <div className="mt-3.5 flex items-center justify-between">
            <span className="text-[13px] font-medium text-muted-foreground">
              {t.import.screenshot.count(fileEntries.length)}
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex h-10.5 items-center gap-1.5 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-85"
            >
              {t.import.screenshot.analyze}
              <ChevronRight size={18} />
            </button>
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </ImportCard>
  );
}
