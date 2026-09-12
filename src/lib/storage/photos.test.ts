import { describe, it, expect } from "vitest";
import { photoPathFromUrl, photoStorageConfig } from "./photos";

const S3 = { S3_PUBLIC_URL: "https://mijote-photos.s3.gra.io.cloud.ovh.net" };

describe("photoPathFromUrl", () => {
  it("retrouve le chemin d'une URL S3, sans le cache-buster", () => {
    expect(
      photoPathFromUrl("https://mijote-photos.s3.gra.io.cloud.ovh.net/h1/r1/photo.webp?v=123", S3),
    ).toBe("h1/r1/photo.webp");
  });

  it("retrouve le chemin d'une ancienne URL Supabase (avant backfill)", () => {
    expect(
      photoPathFromUrl(
        "https://x.supabase.co/storage/v1/object/public/recipe-photos/generated/r1/ai-image.webp?v=1",
        S3,
      ),
    ).toBe("generated/r1/ai-image.webp");
  });

  it("décode les chemins encodés", () => {
    expect(photoPathFromUrl("https://mijote-photos.s3.gra.io.cloud.ovh.net/h1/r%201/photo.webp", S3)).toBe(
      "h1/r 1/photo.webp",
    );
  });

  it("renvoie null pour une URL externe", () => {
    expect(photoPathFromUrl("https://example.com/recipe.jpg", S3)).toBeNull();
  });

  it("fonctionne sans S3_PUBLIC_URL (repli Supabase uniquement)", () => {
    expect(photoPathFromUrl("https://x.supabase.co/storage/v1/object/public/recipe-photos/a/b.webp", {})).toBe("a/b.webp");
    expect(photoPathFromUrl("https://mijote-photos.s3.gra.io.cloud.ovh.net/a/b.webp", {})).toBeNull();
  });
});

describe("photoStorageConfig", () => {
  it("est null sans S3_BUCKET (pilote Supabase)", () => {
    expect(photoStorageConfig({})).toBeNull();
  });

  it("normalise l'URL publique", () => {
    const c = photoStorageConfig({
      S3_BUCKET: "b",
      S3_ENDPOINT: "https://s3.gra.io.cloud.ovh.net",
      S3_PUBLIC_URL: "https://b.s3.gra.io.cloud.ovh.net/",
      S3_ACCESS_KEY_ID: "k",
      S3_SECRET_ACCESS_KEY: "s",
    });
    expect(c?.publicUrl).toBe("https://b.s3.gra.io.cloud.ovh.net");
    expect(c?.region).toBe("gra");
  });
});
