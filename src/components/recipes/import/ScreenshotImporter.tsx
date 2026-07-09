"use client";

import { useState, useRef, useEffect } from "react";
import NextImage from "next/image";
import { Image as ImageIcon, ChevronRight, Upload, Plus, X } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { Capacitor } from "@capacitor/core";
import { t } from "@/lib/i18n/fr";
import ImportCard from "./ImportCard";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;

// Android only: the WebView's <input type=file> can't offer a camera/gallery
// choice (it's gallery-only without `capture`, camera-only with it). iOS/Web
// keep the native <input> below — its picker already offers both.
const IS_ANDROID = Capacitor.getPlatform() === "android";

// @capacitor/camera reject codes that mean "the user backed out", not a real
// failure — these stay silent. Anything else is a genuine error worth surfacing.
const CAMERA_CANCEL_CODES = new Set([
  "OS-PLUG-CAMR-0006", // TakePhotoCancelled
  "OS-PLUG-CAMR-0013", // EditPhotoCancelled
  "OS-PLUG-CAMR-0020", // ChooseMediaCancelled
]);

function isPickerCancellation(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (code) return CAMERA_CANCEL_CODES.has(code);
  // Legacy/iOS path rejects with a message, not a code.
  return ((e as { message?: string })?.message ?? "")
    .toLowerCase()
    .includes("cancel");
}

// Fetch a Capacitor camera result back into a File so it flows through the
// same addFiles() pipeline as <input>-selected files. Prefer webPath; fall
// back to convertFileSrc(uri) so a native uri-only result still loads.
async function mediaResultToFile(
  result: { webPath?: string; uri?: string },
  name: string,
): Promise<File | null> {
  const src = result.webPath ?? (result.uri && Capacitor.convertFileSrc(result.uri));
  if (!src) return null;
  try {
    const blob = await (await fetch(src)).blob();
    const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
    return new File([blob], `${name}.${ext}`, {
      type: blob.type || "image/jpeg",
    });
  } catch {
    return null;
  }
}

interface FileWithKey {
  file: File;
  key: string;
  previewUrl: string;
}

interface ScreenshotImporterProps {
  expanded: boolean;
  onToggle: () => void;
  error: string | null;
  onError: (message: string) => void;
  onSubmit: (files: File[]) => void;
}

export default function ScreenshotImporter({
  expanded,
  onToggle,
  error,
  onError,
  onSubmit,
}: ScreenshotImporterProps) {
  const [fileEntries, setFileEntries] = useState<FileWithKey[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // F4: Revoke object URLs on unmount. Mirror the entries in a ref: a []-deps
  // cleanup closes over the first render's (empty) array and would revoke
  // nothing — full-resolution previews would leak on every visit.
  const entriesRef = useRef<FileWithKey[]>([]);
  entriesRef.current = fileEntries;
  useEffect(() => {
    return () => {
      entriesRef.current.forEach((e) => URL.revokeObjectURL(e.previewUrl));
    };
  }, []);

  function addFiles(newFiles: FileList | File[] | null) {
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
      }))].slice(0, MAX_FILES);
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

  // Android: prompt camera-vs-gallery (plugins lazy-loaded so iOS/Web never
  // touch them), then funnel the result through addFiles() like the <input>.
  async function openAndroidPicker() {
    const remaining = MAX_FILES - fileEntries.length;
    if (remaining <= 0) return;

    const { ActionSheet, ActionSheetButtonStyle } = await import(
      "@capacitor/action-sheet"
    );
    const { Camera } = await import("@capacitor/camera");

    let choice;
    try {
      choice = await ActionSheet.showActions({
        title: t.import.screenshot.sourceTitle,
        options: [
          { title: t.import.screenshot.takePhoto },
          { title: t.import.screenshot.fromGallery },
          {
            title: t.import.screenshot.cancel,
            style: ActionSheetButtonStyle.Cancel,
          },
        ],
      });
    } catch {
      return; // sheet dismissed
    }

    const stamp = Date.now();
    try {
      if (choice.index === 0) {
        const photo = await Camera.takePhoto({});
        const file = await mediaResultToFile(photo, `photo-${stamp}`);
        if (!file) throw new Error("camera photo could not be read");
        addFiles([file]);
      } else if (choice.index === 1) {
        const { results } = await Camera.chooseFromGallery({
          allowMultipleSelection: true,
          limit: remaining,
        });
        if (results.length === 0) return; // nothing selected
        const files = (
          await Promise.all(
            results.map((r, i) => mediaResultToFile(r, `photo-${stamp}-${i}`)),
          )
        ).filter((f): f is File => f !== null);
        if (files.length === 0) throw new Error("gallery images could not be read");
        addFiles(files);
      }
    } catch (e) {
      if (isPickerCancellation(e)) return; // user backed out — stay silent
      Sentry.captureException(e instanceof Error ? e : new Error(String(e)), {
        tags: { feature: "import", source: "photo", platform: "android" },
      });
      onError(t.import.error);
    }
  }

  function handleAddClick(inputRef: React.RefObject<HTMLInputElement | null>) {
    if (IS_ANDROID) {
      void openAndroidPicker();
    } else {
      inputRef.current?.click();
    }
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
        <button
          type="button"
          className="w-full cursor-pointer rounded-[14px] border-2 border-dashed border-border bg-background p-6 text-center transition-all hover:border-accent hover:bg-[rgba(110,122,56,0.12)]"
          onClick={() => handleAddClick(fileInputRef)}
        >
          <Upload size={32} className="mx-auto mb-2 text-accent" />
          <p className="text-sm font-medium">{t.import.screenshot.upload}</p>
          <span className="mt-1 block text-xs text-muted-foreground">
            {t.import.screenshot.uploadHint}
          </span>
        </button>
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
            {fileEntries.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => handleAddClick(addMoreInputRef)}
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
