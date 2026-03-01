"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase/client";
import { getDeviceToken } from "./useDeviceToken";

export function buildStoragePath(deviceToken: string, recipeId: string): string {
  return `${deviceToken}/${recipeId}/photo.webp`;
}

export async function _uploadToStorage(
  supabase: SupabaseClient,
  file: File,
  path: string
): Promise<{ url: string } | { error: string }> {
  const { error } = await supabase.storage
    .from("recipe-photos")
    .upload(path, file, { upsert: true });

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
    const path = buildStoragePath(deviceToken, recipeId);
    const supabase = createBrowserClient();

    const storageResult = await _uploadToStorage(supabase, file, path);
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
