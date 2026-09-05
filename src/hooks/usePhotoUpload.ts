"use client";

import { resizeImageToBlob } from "@/lib/image-resize";
import { useT } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n/types";

// Matches the server-side cap on /api/recipes/[id]/photo (Vercel body limit).
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// Fonction pure (testable hors React) ; le hook ci-dessous lie le dictionnaire
// de la langue courante.
export async function uploadPhoto(
  file: File,
  recipeId: string,
  t: Dictionary,
): Promise<{ url: string } | { error: string }> {
  // Downscale + compress before upload (~1280px, WebP/JPEG ~0.8) so the
  // stored image is web-weight (~150-300 KB) instead of a multi-MB original.
  // Fall back to the raw file if the browser can't process it.
  let payload: Blob = file;
  let filename = file.name || "photo";
  try {
    const resized = await resizeImageToBlob(file);
    payload = resized.blob;
    filename = `photo.${resized.ext}`;
  } catch {
    // Keep the original file (rare: missing canvas/createImageBitmap support).
  }

  if (payload.size > MAX_UPLOAD_BYTES) {
    return { error: t.feedback.photoTooLarge };
  }

  // The server (service role) uploads to Storage and persists photo_url —
  // the browser never talks to Supabase directly.
  const formData = new FormData();
  formData.append("photo", payload, filename);
  const response = await fetch(`/api/recipes/${recipeId}/photo`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    return { error: t.feedback.photoSaveError };
  }

  const data = await response.json().catch(() => null);
  if (!data?.url) {
    return { error: t.feedback.photoSaveError };
  }
  return { url: data.url };
}

export function usePhotoUpload() {
  const t = useT();
  return {
    uploadPhoto: (file: File, recipeId: string) => uploadPhoto(file, recipeId, t),
  };
}
