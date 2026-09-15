"use client";

import { useState, useRef, useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Camera, Link2, Mic, PenLine, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { haptics } from "@/lib/haptics";
import { resizeImageToBase64 } from "@/lib/image-resize";
import { useVoiceSupported } from "@/hooks/useVoiceRecorder";
import ScreenshotImporter from "@/components/recipes/import/ScreenshotImporter";
import VoiceImporter from "@/components/recipes/import/VoiceImporter";
import UrlImporter from "@/components/recipes/import/UrlImporter";
import ImportLoading from "@/components/recipes/import/ImportLoading";
import type { ImportedRecipeData } from "@/lib/import";
import type { RecipeSource } from "@/lib/schemas/recipe";

type ExpandedCard = "screenshot" | "voice" | "url" | null;

// Client-side backstop so a stalled request can never spin forever. Generous:
// voice transcription of a 3-min clip + extraction can legitimately take a
// while; this only catches true network/server hangs.
const REQUEST_TIMEOUT_MS = 60_000;

interface ImportSelectorProps {
  onImportComplete: (data: ImportedRecipeData, source: RecipeSource) => void;
  onManual: () => void;
  // When set (e.g. from the iOS share sheet, which loads this flow with
  // ?import=url&url=…), the URL import starts automatically on mount.
  autoImportUrl?: string | null;
  // Écran « Ta première recette » (bras B du A/B onboarding #25) : recette
  // d'exemple proposée en pied, importée par le chemin URL normal.
  sampleUrl?: string | null;
}

// Orchestrates the three import modes. Shared state (one request at a time,
// one expanded card, per-card error display) lives here; each importer owns
// its own UI and local state.
export default function ImportSelector({
  onImportComplete,
  onManual,
  autoImportUrl,
  sampleUrl,
}: ImportSelectorProps) {
  const t = useT();
  const voiceSupported = useVoiceSupported();
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

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

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

      const data = (await res.json().catch(() => null)) as ImportedRecipeData | null;
      if (!data) throw new Error(mapError(undefined));
      void haptics.success();
      onImportComplete(data, source);
    } catch (err) {
      if (timedOut) {
        Sentry.captureException(new Error("Import request timed out"), {
          tags: { feature: "import", source },
        });
        setError(t.import.error);
      } else if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || t.import.error);
      }
    } finally {
      clearTimeout(timeoutId);
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
    await runImport({ path: "/api/recipes/import/voice", body: formData }, "voice", (code) =>
      code === "IMPORT_QUOTA" ? t.import.errorImportQuota : t.import.voice.error,
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

  // Global loading screen: shown only once a request is actually in flight.
  // NOT gated on voiceProcessing — that flag flips the instant Stop is pressed,
  // and unmounting VoiceImporter then would destroy the recorder before its
  // onstop fires, so the blob would never reach submitVoiceBlob (infinite
  // spinner). voiceProcessing instead drives an in-card "finalizing" state
  // while the blob is assembled; runImport sets `loading` for the real upload.
  if (loading) {
    return <ImportLoading />;
  }

  // Spec #24 : la tuile choisie devient le panneau d'action ; les autres
  // méthodes se replient en puces « Ou plutôt » sous le panneau. Les trois
  // importeurs restent MONTÉS (masqués par `hidden`, jamais démontés) :
  // démonter VoiceImporter en cours de dictée détruirait l'enregistreur.
  const cards: { key: Exclude<ExpandedCard, null>; icon: LucideIcon; chip: string }[] = [
    { key: "url", icon: Link2, chip: t.import.url.chip },
    { key: "screenshot", icon: Camera, chip: t.import.screenshot.chip },
    ...(voiceSupported ? [{ key: "voice" as const, icon: Mic, chip: t.import.voice.chip }] : []),
  ];
  const hide = (card: ExpandedCard) => expanded !== null && expanded !== card;

  return (
    <div className="flex flex-col gap-3">
      {!autoImportUrl && !expanded && (
        <h2 className="display mb-1 text-[22px] font-semibold tracking-[-0.015em]">
          {t.import.question}
        </h2>
      )}

      {/* `data-track` par méthode (#28) : tout clic dans le panneau vaut
          « méthode choisie », le bouton d'envoi porte `import.submit`. */}
      <div hidden={hide("url")} data-track="import.url">
        <UrlImporter
          expanded={expanded === "url"}
          onToggle={() => toggleCard("url")}
          error={expanded === "url" ? error : null}
          onSubmit={submitUrl}
          initialUrl={autoImportUrl ?? undefined}
        />
      </div>

      <div hidden={hide("screenshot")} data-track="import.photo">
        <ScreenshotImporter
          expanded={expanded === "screenshot"}
          onToggle={() => toggleCard("screenshot")}
          error={expanded === "screenshot" ? error : null}
          onError={setError}
          onSubmit={submitScreenshots}
        />
      </div>

      <div hidden={hide("voice")} data-track="import.voice">
        <VoiceImporter
          expanded={expanded === "voice"}
          onToggle={() => toggleCard("voice")}
          error={expanded === "voice" ? error : null}
          processing={voiceProcessing}
          onError={(msg) => {
            setVoiceProcessing(false); // recorder failed → release the spinner
            setError(msg);
          }}
          onBlobReady={submitVoiceBlob}
          onStopRequested={() => setVoiceProcessing(true)}
        />
      </div>

      {expanded === null ? (
        <>
          {/* Séparateur + carte manuel : un cran sous les trois imports (icône
              neutre, ombre légère), mais une vraie carte — ≈ 1 recette sur 9,
              1 première recette sur 5. */}
          <div className="mx-1 mt-2 flex items-center gap-3.5 py-1.5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.import.divider}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            onClick={onManual}
            data-track="import.manual"
            className="flex w-full cursor-pointer items-center gap-4 rounded-[22px] border-[1.5px] border-border bg-surface px-[18px] py-3.5 text-left transition-all hover:border-accent active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            style={{ boxShadow: "var(--card-shadow-sm)" }}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary">
              <PenLine size={22} className="text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-medium">{t.import.manual.title}</h3>
              <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">
                {t.import.manual.description}
              </p>
            </div>
          </button>
          {sampleUrl && (
            <p className="mt-4 text-center text-[14px] leading-relaxed text-muted-foreground">
              {t.import.firstNoRecipe}
              <br />
              <button
                type="button"
                data-track="import.sample"
                onClick={() => {
                  setExpanded("url");
                  void submitUrl(sampleUrl);
                }}
                className="cursor-pointer border-b-[1.5px] border-accent/35 font-semibold text-accent transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {t.import.firstTryThis}
              </button>
            </p>
          )}
        </>
      ) : (
        <div className="mt-2">
          <p className="mx-1 mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.import.orRather}
          </p>
          <div className="flex flex-wrap gap-2">
            {cards
              .filter((c) => c.key !== expanded)
              .map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => toggleCard(c.key)}
                  data-track={c.key === "screenshot" ? "import.photo" : `import.${c.key}`}
                  className="flex h-10 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-border bg-surface pl-2.5 pr-3.5 text-sm font-medium text-foreground transition-all hover:border-accent active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  style={{ boxShadow: "var(--card-shadow-sm)" }}
                >
                  <c.icon size={18} className="text-accent" aria-hidden="true" />
                  {c.chip}
                </button>
              ))}
            <button
              type="button"
              onClick={onManual}
              data-track="import.manual"
              className="flex h-10 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-border bg-surface pl-2.5 pr-3.5 text-sm font-medium text-foreground transition-all hover:border-accent active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              style={{ boxShadow: "var(--card-shadow-sm)" }}
            >
              <PenLine size={18} className="text-muted-foreground" aria-hidden="true" />
              {t.import.manual.chip}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
