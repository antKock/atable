"use client";

import { useState, useRef, useCallback, useEffect, useSyncExternalStore } from "react";
import { haptics } from "@/lib/haptics";

const MAX_DURATION_S = 180; // 3 minutes
const WAVEFORM_BARS = 20;

export interface VoiceRecorderState {
  isSupported: boolean;
  isRecording: boolean;
  duration: number;
  waveformData: number[];
  audioBlob: Blob | null;
  start: () => Promise<void>;
  stop: () => void;
}

// Mount-only feature detection (no subscription). SSR snapshot = false to
// avoid hydration mismatch; client snapshot reads the real APIs.
const noopSubscribe = () => () => {};
const detectMediaSupport = () =>
  typeof MediaRecorder !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia;
const ssrMediaSupport = () => false;

export function useVoiceRecorder(): VoiceRecorderState {
  const isSupported = useSyncExternalStore(
    noopSubscribe,
    detectMediaSupport,
    ssrMediaSupport,
  );
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>(() =>
    new Array(WAVEFORM_BARS).fill(0),
  );
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // updateWaveform schedules itself via rAF. We define the recursive tick as
  // a local `const`: the inner self-reference is resolved at call time, after
  // the binding is initialized — no TDZ / "accessed before declared" issue.
  const updateWaveform = useCallback(() => {
    const tick = (): void => {
      if (!analyserRef.current) return;
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);

      const step = Math.floor(data.length / WAVEFORM_BARS);
      const bars: number[] = [];
      for (let i = 0; i < WAVEFORM_BARS; i++) {
        bars.push(data[i * step] / 255);
      }
      setWaveformData(bars);

      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      void haptics.medium();
    }
    setIsRecording(false);
    setWaveformData(new Array(WAVEFORM_BARS).fill(0));
    cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    if (!isSupported) return;

    setAudioBlob(null);
    setDuration(0);
    chunksRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    // Set up Web Audio API for waveform
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    // Determine MIME type with fallback
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : undefined; // Let browser pick default (audio/mp4 on iOS Safari)

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      setAudioBlob(blob);
    };

    recorder.start(1000); // Collect data every second
    setIsRecording(true);
    void haptics.medium();
    startTimeRef.current = Date.now();

    // Duration timer
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDuration(elapsed);
      if (elapsed >= MAX_DURATION_S) {
        stop();
      }
    }, 100);

    // Start waveform animation
    rafRef.current = requestAnimationFrame(updateWaveform);
  }, [isSupported, stop, updateWaveform]);

  return {
    isSupported,
    isRecording,
    duration,
    waveformData,
    audioBlob,
    start,
    stop,
  };
}
