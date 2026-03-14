"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL = 3000;
const MAX_DURATION = 60_000;

function isTerminal(enrichment: string, image: string): boolean {
  const enrichmentDone = ["enriched", "failed", "none"].includes(enrichment);
  const imageDone = ["generated", "failed", "none"].includes(image);
  return enrichmentDone && imageDone;
}

export function useEnrichmentPolling(
  recipeId: string,
  initialEnrichmentStatus: string,
  initialImageStatus: string,
) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());
  const lastEnrichmentRef = useRef(initialEnrichmentStatus);
  const lastImageRef = useRef(initialImageStatus);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isTerminal(initialEnrichmentStatus, initialImageStatus)) return;

    startTimeRef.current = Date.now();
    lastEnrichmentRef.current = initialEnrichmentStatus;
    lastImageRef.current = initialImageStatus;

    intervalRef.current = setInterval(async () => {
      if (Date.now() - startTimeRef.current > MAX_DURATION) {
        cleanup();
        return;
      }

      try {
        const res = await fetch(`/api/recipes/${recipeId}/status`);
        if (!res.ok) return;
        const { enrichmentStatus, imageStatus } = await res.json();

        if (
          enrichmentStatus !== lastEnrichmentRef.current ||
          imageStatus !== lastImageRef.current
        ) {
          lastEnrichmentRef.current = enrichmentStatus;
          lastImageRef.current = imageStatus;
          router.refresh();
        }

        if (isTerminal(enrichmentStatus, imageStatus)) {
          cleanup();
        }
      } catch {
        // Network error — silently retry on next interval
      }
    }, POLL_INTERVAL);

    return cleanup;
  }, [recipeId, initialEnrichmentStatus, initialImageStatus, router, cleanup]);
}
