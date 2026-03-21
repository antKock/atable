"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Image, Link2, AlignLeft, ChevronRight, Upload, Plus, X, Loader2, Mic, Square } from "lucide-react";
import { t } from "@/lib/i18n/fr";
import { resizeImageToBase64 } from "@/lib/image-resize";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import type { ImportedRecipeData } from "@/lib/import";

type ExpandedCard = "screenshot" | "voice" | "url" | null;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface FileWithKey {
  file: File;
  key: string;
  previewUrl: string;
}

interface ImportSelectorProps {
  onImportComplete: (data: ImportedRecipeData) => void;
  onManual: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ImportSelector({ onImportComplete, onManual }: ImportSelectorProps) {
  const [expanded, setExpanded] = useState<ExpandedCard>(null);
  const [fileEntries, setFileEntries] = useState<FileWithKey[]>([]);
  const [urlValue, setUrlValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voice = useVoiceRecorder();

  // Submit voice recording when audioBlob is ready
  useEffect(() => {
    if (!voice.audioBlob) return;
    async function submitVoice(blob: Blob) {
      setVoiceProcessing(true);
      setLoading(true);
      setError(null);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const formData = new FormData();
        const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
        formData.append("audio", blob, `recording.${ext}`);

        const res = await fetch("/api/recipes/import/voice", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(t.import.voice.error);

        const data: ImportedRecipeData = await res.json();
        onImportComplete(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || t.import.voice.error);
        }
      } finally {
        setVoiceProcessing(false);
        setLoading(false);
      }
    }
    submitVoice(voice.audioBlob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.audioBlob]);

  // F9: Focus URL input when card expands
  useEffect(() => {
    if (expanded === "url") {
      urlInputRef.current?.focus();
    }
  }, [expanded]);

  // F8: Abort in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // F4: Revoke object URLs on cleanup
  const revokeAll = useCallback((entries: FileWithKey[]) => {
    entries.forEach((e) => URL.revokeObjectURL(e.previewUrl));
  }, []);

  useEffect(() => {
    return () => revokeAll(fileEntries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCard(card: ExpandedCard) {
    if (loading) return;
    setExpanded((prev) => (prev === card ? null : card));
    setError(null);
  }

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

  async function handleScreenshotSubmit() {
    if (fileEntries.length === 0 || loading) return;
    setLoading(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const base64Images = await Promise.all(
        fileEntries.map((e) => resizeImageToBase64(e.file)),
      );

      const res = await fetch("/api/recipes/import/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: base64Images }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error();

      const data: ImportedRecipeData = await res.json();
      onImportComplete(data);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(t.import.error);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUrlSubmit() {
    if (!urlValue.trim() || loading) return;
    setLoading(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/recipes/import/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlValue.trim() }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const code = body?.code as string | undefined;
        if (code === "SITE_BLOCKED") throw new Error(t.import.errorSiteBlocked);
        if (code === "RATE_LIMIT") throw new Error(t.import.errorRateLimit);
        if (code === "SITE_UNREACHABLE") throw new Error(t.import.errorSiteUnreachable);
        throw new Error(t.import.error);
      }

      const data: ImportedRecipeData = await res.json();
      onImportComplete(data);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || t.import.error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Screenshot card */}
      <div
        className={`flex flex-wrap items-center gap-4 rounded-[18px] border-[1.5px] bg-surface p-3.5 transition-all ${
          expanded === "screenshot"
            ? "border-accent shadow-[0_2px_16px_rgba(110,122,56,0.12)]"
            : "border-border cursor-pointer hover:border-accent hover:shadow-[0_2px_12px_rgba(110,122,56,0.10)] active:scale-[0.985]"
        }`}
        onClick={() => expanded !== "screenshot" && toggleCard("screenshot")}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(110,122,56,0.12)]">
          <Image size={20} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{t.import.screenshot.title}</h3>
          {expanded === "screenshot" && (
            <p className="text-[13px] leading-tight text-muted-foreground">
              {t.import.screenshot.description}
            </p>
          )}
        </div>
        <ChevronRight
          size={18}
          className={`shrink-0 text-muted-foreground opacity-50 transition-transform ${
            expanded === "screenshot" ? "rotate-90" : ""
          }`}
        />

        {/* Expanded content */}
        {expanded === "screenshot" && (
          <div className="mt-0.5 basis-full" onClick={(e) => e.stopPropagation()}>
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
                      className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[10px] border-[1.5px] border-border"
                    >
                      <img
                        src={entry.previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(entry.key)}
                        className="absolute right-[3px] top-[3px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  {fileEntries.length < 5 && (
                    <button
                      type="button"
                      onClick={() => addMoreInputRef.current?.click()}
                      className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[10px] border-2 border-dashed border-border text-muted-foreground transition-all hover:border-accent hover:text-accent"
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
                  {loading ? (
                    <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleScreenshotSubmit}
                      className="flex h-[42px] items-center gap-1.5 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-85"
                    >
                      {t.import.screenshot.analyze}
                      <ChevronRight size={18} />
                    </button>
                  )}
                </div>
              </>
            )}

            {error && expanded === "screenshot" && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
          </div>
        )}
      </div>

      {/* Voice card */}
      {voice.isSupported && (
        <div
          className={`flex flex-wrap items-center gap-4 rounded-[18px] border-[1.5px] bg-surface p-3.5 transition-all ${
            expanded === "voice"
              ? "border-accent shadow-[0_2px_16px_rgba(110,122,56,0.12)]"
              : "border-border cursor-pointer hover:border-accent hover:shadow-[0_2px_12px_rgba(110,122,56,0.10)] active:scale-[0.985]"
          }`}
          onClick={() => expanded !== "voice" && toggleCard("voice")}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(110,122,56,0.12)]">
            <Mic size={20} className="text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">{t.import.voice.title}</h3>
            {expanded === "voice" && (
              <p className="text-[13px] leading-tight text-muted-foreground">
                {t.import.voice.description}
              </p>
            )}
          </div>
          <ChevronRight
            size={18}
            className={`shrink-0 text-muted-foreground opacity-50 transition-transform ${
              expanded === "voice" ? "rotate-90" : ""
            }`}
          />

          {/* Expanded content */}
          {expanded === "voice" && (
            <div className="mt-0.5 basis-full" onClick={(e) => e.stopPropagation()}>
              {voiceProcessing ? (
                /* Processing state */
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 size={32} className="animate-spin text-accent" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {t.import.voice.processing}
                  </p>
                </div>
              ) : voice.isRecording ? (
                /* Recording state */
                <div className="flex flex-col items-center gap-4 py-4">
                  {/* Waveform visualizer */}
                  <div className="flex h-12 items-end gap-[3px]">
                    {voice.waveformData.map((v, i) => (
                      <div
                        key={i}
                        className="w-[6px] rounded-full bg-accent transition-all duration-75"
                        style={{ height: `${Math.max(4, v * 48)}px` }}
                      />
                    ))}
                  </div>
                  {/* Timer */}
                  <span className="font-mono text-lg font-semibold text-foreground">
                    {formatDuration(voice.duration)}
                  </span>
                  {/* Stop button */}
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceProcessing(true);
                      voice.stop();
                    }}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white transition-opacity hover:opacity-85"
                  >
                    <Square size={20} fill="currentColor" />
                  </button>
                </div>
              ) : (
                /* Idle state */
                <div className="flex flex-col items-center gap-3 py-4">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await voice.start();
                      } catch {
                        setError(t.import.voice.errorNoMic);
                      }
                    }}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity hover:opacity-85"
                  >
                    <Mic size={28} />
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {t.import.voice.maxDuration}
                  </p>
                </div>
              )}

              {error && expanded === "voice" && (
                <p className="mt-3 text-center text-sm text-red-600">{error}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* URL card */}
      <div
        className={`flex flex-wrap items-center gap-4 rounded-[18px] border-[1.5px] bg-surface p-3.5 transition-all ${
          expanded === "url"
            ? "border-accent shadow-[0_2px_16px_rgba(110,122,56,0.12)]"
            : "border-border cursor-pointer hover:border-accent hover:shadow-[0_2px_12px_rgba(110,122,56,0.10)] active:scale-[0.985]"
        }`}
        onClick={() => expanded !== "url" && toggleCard("url")}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(110,122,56,0.12)]">
          <Link2 size={20} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{t.import.url.title}</h3>
          {expanded === "url" && (
            <p className="text-[13px] leading-tight text-muted-foreground">
              {t.import.url.description}
            </p>
          )}
        </div>
        <ChevronRight
          size={18}
          className={`shrink-0 text-muted-foreground opacity-50 transition-transform ${
            expanded === "url" ? "rotate-90" : ""
          }`}
        />

        {/* Expanded content */}
        {expanded === "url" && (
          <div className="mt-0.5 basis-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5">
              <input
                ref={urlInputRef}
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                placeholder={t.import.url.placeholder}
                className="h-11 flex-1 rounded-xl border-[1.5px] border-border bg-background px-3.5 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus:border-accent focus:shadow-[0_0_0_3px_rgba(110,122,56,0.15)]"
              />
              {loading ? (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleUrlSubmit}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity hover:opacity-85"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
            {error && expanded === "url" && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-1 flex items-center gap-3.5 py-1.5">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.import.divider}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Manual card */}
      <div
        onClick={onManual}
        className="flex cursor-pointer items-center gap-4 rounded-[18px] border-[1.5px] border-dashed border-border bg-transparent p-3.5 transition-all hover:border-muted-foreground active:scale-[0.985]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
          <AlignLeft size={20} className="text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-medium text-muted-foreground">
            {t.import.manual.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t.import.manual.description}
          </p>
        </div>
        <ChevronRight
          size={16}
          className="shrink-0 text-muted-foreground opacity-50"
        />
      </div>
    </div>
  );
}
