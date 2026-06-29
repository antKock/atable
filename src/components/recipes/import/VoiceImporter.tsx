"use client";

import { useEffect } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { t } from "@/lib/i18n/fr";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import ImportCard from "./ImportCard";

interface VoiceImporterProps {
  expanded: boolean;
  onToggle: () => void;
  error: string | null;
  // True from the moment Stop is pressed until the import resolves. Drives the
  // in-card "finalizing" indicator during the brief window while the recorder
  // flushes its blob (this component must stay mounted for onstop to fire).
  processing: boolean;
  onError: (message: string) => void;
  onBlobReady: (blob: Blob) => void;
  onStopRequested: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VoiceImporter({
  expanded,
  onToggle,
  error,
  processing,
  onError,
  onBlobReady,
  onStopRequested,
}: VoiceImporterProps) {
  const voice = useVoiceRecorder();

  // Submit voice recording when audioBlob is ready
  useEffect(() => {
    if (!voice.audioBlob) return;
    onBlobReady(voice.audioBlob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.audioBlob]);

  // Recording failed to yield a blob (recorder error / onstop never fired):
  // surface it so the parent clears the spinner instead of hanging.
  useEffect(() => {
    if (voice.error) onError(t.import.voice.errorRecording);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.error]);

  if (!voice.isSupported) return null;

  return (
    <ImportCard
      icon={Mic}
      title={t.import.voice.title}
      description={t.import.voice.description}
      expanded={expanded}
      onToggle={onToggle}
    >
      {voice.isRecording ? (
        /* Recording state */
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Waveform visualizer */}
          <div className="flex h-12 items-end gap-0.75">
            {voice.waveformData.map((v, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-accent transition-all duration-75"
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
              onStopRequested();
              voice.stop();
            }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white transition-opacity hover:opacity-85"
          >
            <Square size={20} fill="currentColor" />
          </button>
        </div>
      ) : processing ? (
        /* Finalizing state: recorder flushing its blob before upload */
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 size={28} className="animate-spin text-accent" />
          <p className="text-xs text-muted-foreground">
            {t.import.voice.processing}
          </p>
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
                onError(t.import.voice.errorNoMic);
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

      {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
    </ImportCard>
  );
}
