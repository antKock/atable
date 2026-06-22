"use client";

import { useState, useRef, useEffect } from "react";
import { AlignLeft, ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n/fr";
import { haptics } from "@/lib/haptics";
import { resizeImageToBase64 } from "@/lib/image-resize";
import ScreenshotImporter from "./import/ScreenshotImporter";
import VoiceImporter from "./import/VoiceImporter";
import UrlImporter from "./import/UrlImporter";
import ImportLoading from "./import/ImportLoading";
import type { ImportedRecipeData } from "@/lib/import";
import type { RecipeSource } from "@/lib/schemas/recipe";

type ExpandedCard = "screenshot" | "voice" | "url" | null;

interface ImportSelectorProps {
  onImportComplete: (data: ImportedRecipeData, source: RecipeSource) => void;
  onManual: () => void;
  // When set (e.g. from the iOS share sheet via mijote://import), the URL
  // import starts automatically on mount.
  autoImportUrl?: string | null;
}

// Orchestrates the three import modes. Shared state (one request at a time,
// one expanded card, per-card error display) lives here; each importer owns
// its own UI and local state.
export default function ImportSelector({
  onImportComplete,
  onManual,
  autoImportUrl,
}: ImportSelectorProps) {
  const [expanded, setExpanded] = useState<ExpandedCard>(null);
  // Démarre déjà en loading si un auto-import est prévu (partage / deep link) :
  // évite de peindre le sélecteur de cartes une fraction de seconde avant que
  // l'effet n'enclenche l'import.
  const [loading, setLoading] = useState(!!autoImportUrl);
  const [error, setError] = useState<string | null>(null);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // F8: Abort in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Auto-start the URL import when arriving from the share sheet. Guarded so it
  // only ever fires once, even if the prop re-renders.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoImportUrl && !autoStarted.current) {
      autoStarted.current = true;
      setExpanded("url");
      void submitUrl(autoImportUrl);
    }
    // submitUrl is stable enough for this one-shot effect; only react to the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoImportUrl]);

  function toggleCard(card: ExpandedCard) {
    if (loading) return;
    setExpanded((prev) => (prev === card ? null : card));
    setError(null);
  }

  // Shared request runner: abort bookkeeping, error mapping, success haptic.
  async function runImport(
    init: { path: string; body: BodyInit; headers?: HeadersInit },
    source: RecipeSource,
    mapError: (code: string | undefined) => string,
  ) {
    setLoading(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(init.path, {
        method: "POST",
        headers: init.headers,
        body: init.body,
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(mapError(body?.code as string | undefined));
      }

      const data: ImportedRecipeData = await res.json();
      void haptics.success();
      onImportComplete(data, source);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || t.import.error);
      }
    } finally {
      setVoiceProcessing(false);
      setLoading(false);
    }
  }

  async function submitScreenshots(files: File[]) {
    const base64Images = await Promise.all(files.map((f) => resizeImageToBase64(f)));
    await runImport(
      {
        path: "/api/recipes/import/screenshot",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: base64Images }),
      },
      "photo",
      (code) => (code === "IMPORT_QUOTA" ? t.import.errorImportQuota : t.import.error),
    );
  }

  async function submitVoiceBlob(blob: Blob) {
    setVoiceProcessing(true);
    const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
    const formData = new FormData();
    formData.append("audio", blob, `recording.${ext}`);
    await runImport(
      { path: "/api/recipes/import/voice", body: formData },
      "voice",
      (code) => (code === "IMPORT_QUOTA" ? t.import.errorImportQuota : t.import.voice.error),
    );
  }

  async function submitUrl(url: string) {
    await runImport(
      {
        path: "/api/recipes/import/url",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      },
      "url",
      (code) => {
        if (code === "SITE_BLOCKED") return t.import.errorSiteBlocked;
        if (code === "RATE_LIMIT") return t.import.errorRateLimit;
        if (code === "IMPORT_QUOTA") return t.import.errorImportQuota;
        if (code === "SITE_UNREACHABLE") return t.import.errorSiteUnreachable;
        return t.import.error;
      },
    );
  }

  // Global loading screen: shown for any import in flight (URL typed or shared,
  // screenshot, voice transcription), replacing the cards for the duration.
  if (loading || voiceProcessing) {
    return (
      <ImportLoading
        message={voiceProcessing ? t.import.voice.processing : t.import.loading}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <ScreenshotImporter
        expanded={expanded === "screenshot"}
        onToggle={() => toggleCard("screenshot")}
        loading={loading}
        error={expanded === "screenshot" ? error : null}
        onSubmit={submitScreenshots}
      />

      <VoiceImporter
        expanded={expanded === "voice"}
        onToggle={() => toggleCard("voice")}
        processing={voiceProcessing}
        error={expanded === "voice" ? error : null}
        onError={setError}
        onBlobReady={submitVoiceBlob}
        onStopRequested={() => setVoiceProcessing(true)}
      />

      <UrlImporter
        expanded={expanded === "url"}
        onToggle={() => toggleCard("url")}
        loading={loading}
        error={expanded === "url" ? error : null}
        onSubmit={submitUrl}
      />

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
