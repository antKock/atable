"use client";

import { useEnrichmentPolling } from "@/hooks/useEnrichmentPolling";

interface EnrichmentPollingWrapperProps {
  recipeId: string;
  enrichmentStatus: string;
  imageStatus: string;
}

export default function EnrichmentPollingWrapper({
  recipeId,
  enrichmentStatus,
  imageStatus,
}: EnrichmentPollingWrapperProps) {
  useEnrichmentPolling(recipeId, enrichmentStatus, imageStatus);
  return null;
}
