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
  // Initialized in the polling effect (Date.now() is impure during render)
  const startTimeRef = useRef<number>(0);
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
      // App en arrière-plan : iOS coupe les requêtes en vol, et un refresh RSC
      // interrompu en plein flux atterrit sur l'écran d'erreur (Sentry
      // « TypeError: Load failed », 2026-09-16). On attend le retour au premier plan.
      if (document.visibilityState !== "visible") return;

      try {
        const res = await fetch(`/api/recipes/${recipeId}/status`);
        if (!res.ok) return;
        const parsed = (await res.json().catch(() => null)) as {
          enrichmentStatus?: string;
          imageStatus?: string;
        } | null;
        if (typeof parsed?.enrichmentStatus !== "string" || typeof parsed.imageStatus !== "string")
          return;
        const { enrichmentStatus, imageStatus } = parsed;

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
