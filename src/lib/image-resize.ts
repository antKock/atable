/**
 * Client-only: Resizes an image file to fit within maxDimension and returns a base64 data URI.
 * Uses browser Canvas API — do not import server-side.
 */
export async function resizeImageToBase64(
  file: File,
  maxDimension = 2048,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if either dimension exceeds max
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Client-only: downscale an image to fit `maxDimension` (longest side),
 * preserving aspect ratio AND EXIF orientation (via createImageBitmap), then
 * compress it. Returns the encoded blob + its extension. Prefers WebP; falls
 * back to JPEG when the browser can't encode WebP through canvas (e.g. some
 * iOS versions). Browser Canvas API — do not import server-side.
 */
export async function resizeImageToBlob(
  file: File,
  maxDimension = 1280,
  quality = 0.82,
): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas context unavailable");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encode = (type: string, q: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));

  // toBlob with an unsupported type silently yields PNG, so check the result.
  const webp = await encode("image/webp", quality);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };

  const jpeg = await encode("image/jpeg", 0.85);
  if (jpeg) return { blob: jpeg, ext: "jpg" };

  throw new Error("Image encoding failed");
}
