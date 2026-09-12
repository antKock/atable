// Plomberie Capacitor du choix de photos sur Android (revue 2026-09-12 :
// sortie de ScreenshotImporter, qui ne garde que l'UI). Le plugin
// @capacitor/camera est chargé à la demande : iOS et le web ne le touchent
// jamais (leur <input type=file> natif propose déjà caméra + galerie).

import { Capacitor } from "@capacitor/core";

// Codes de rejet du plugin qui signifient « l'utilisateur a renoncé », pas une
// vraie erreur — à laisser silencieux. Tout autre rejet mérite d'être remonté.
const CAMERA_CANCEL_CODES = new Set([
  "OS-PLUG-CAMR-0006", // TakePhotoCancelled
  "OS-PLUG-CAMR-0013", // EditPhotoCancelled
  "OS-PLUG-CAMR-0020", // ChooseMediaCancelled
]);

export function isPickerCancellation(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (code) return CAMERA_CANCEL_CODES.has(code);
  // Chemin historique / iOS : rejet avec un message, pas un code.
  return ((e as { message?: string })?.message ?? "").toLowerCase().includes("cancel");
}

/**
 * Ramène un résultat du plugin Camera dans un `File` pour qu'il suive le même
 * pipeline que les fichiers choisis via <input>. `webPath` d'abord, sinon
 * `convertFileSrc(uri)` pour un résultat natif sans webPath.
 */
export async function mediaResultToFile(
  result: { webPath?: string; uri?: string },
  name: string,
): Promise<File | null> {
  const src = result.webPath ?? (result.uri && Capacitor.convertFileSrc(result.uri));
  if (!src) return null;
  try {
    const blob = await (await fetch(src)).blob();
    const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
    return new File([blob], `${name}.${ext}`, { type: blob.type || "image/jpeg" });
  } catch {
    return null;
  }
}

/** Prend une photo avec l'appareil. Rejette avec l'erreur du plugin (cf. isPickerCancellation). */
export async function takePhotoAsFile(): Promise<File> {
  const { Camera } = await import("@capacitor/camera");
  const photo = await Camera.takePhoto({});
  const file = await mediaResultToFile(photo, `photo-${Date.now()}`);
  if (!file) throw new Error("camera photo could not be read");
  return file;
}

/**
 * Choisit jusqu'à `limit` images dans la galerie. Tableau vide = rien
 * sélectionné (pas une erreur) ; rejette si aucune image n'a pu être lue.
 */
export async function pickGalleryImagesAsFiles(limit: number): Promise<File[]> {
  const { Camera } = await import("@capacitor/camera");
  const stamp = Date.now();
  const { results } = await Camera.chooseFromGallery({ allowMultipleSelection: true, limit });
  if (results.length === 0) return [];
  const files = (
    await Promise.all(results.map((r, i) => mediaResultToFile(r, `photo-${stamp}-${i}`)))
  ).filter((f): f is File => f !== null);
  if (files.length === 0) throw new Error("gallery images could not be read");
  return files;
}
