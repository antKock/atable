"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase/client";
import { resizeImageToBlob } from "@/lib/image-resize";
import { getDeviceToken } from "./useDeviceToken";

export function buildStoragePath(
  deviceToken: string,
  recipeId: string,
  ext = "webp"
): string {
  return `${deviceToken}/${recipeId}/photo.${ext}`;
}

export async function _uploadToStorage(
  supabase: SupabaseClient,
  file: Blob,
  path: string
): Promise<{ url: string } | { error: string }> {
  const { error } = await supabase.storage
    .from("recipe-photos")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });

  if (error) return { error: error.message };

  const { data } = supabase.storage.from("recipe-photos").getPublicUrl(path);
  return { url: data.publicUrl };
}

export function usePhotoUpload() {
  async function uploadPhoto(
    file: File,
    recipeId: string
  ): Promise<{ url: string } | { error: string }> {
    const deviceToken = getDeviceToken();
    const supabase = createBrowserClient();

    // Downscale + compress before upload (~1280px, WebP/JPEG ~0.8) so the
    // stored image is web-weight (~150-300 KB) instead of a multi-MB original.
    // Fall back to the raw file if the browser can't process it.
    let payload: Blob = file;
    let ext = "webp";
    try {
      const resized = await resizeImageToBlob(file);
      payload = resized.blob;
      ext = resized.ext;
    } catch {
      // Keep the original file (rare: missing canvas/createImageBitmap support).
    }

    const path = buildStoragePath(deviceToken, recipeId, ext);
    const storageResult = await _uploadToStorage(supabase, payload, path);
    if ("error" in storageResult) return storageResult;

    // Persist photo_url to DB and revalidate server cache
    const response = await fetch(`/api/recipes/${recipeId}/photo`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoUrl: storageResult.url }),
    });

    if (!response.ok) {
      return { error: "La photo n'a pas pu être enregistrée" };
    }

    return storageResult;
  }

  return { uploadPhoto };
}
