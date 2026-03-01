import { describe, it, expect, vi } from "vitest";
import { buildStoragePath, _uploadToStorage } from "./usePhotoUpload";

describe("buildStoragePath", () => {
  it("returns the correct path format", () => {
    expect(buildStoragePath("device-abc", "recipe-123")).toBe(
      "device-abc/recipe-123/photo.webp"
    );
  });

  it("uses the device token as the first path segment", () => {
    const path = buildStoragePath("my-device", "my-recipe");
    expect(path.startsWith("my-device/")).toBe(true);
  });

  it("uses the recipe id as the second path segment", () => {
    const path = buildStoragePath("token", "rec-456");
    expect(path).toContain("/rec-456/");
  });

  it("always ends with photo.webp", () => {
    const path = buildStoragePath("a", "b");
    expect(path.endsWith("photo.webp")).toBe(true);
  });
});

describe("_uploadToStorage", () => {
  function makeMockSupabase(opts: {
    uploadError?: string | null;
    publicUrl?: string;
  }) {
    const { uploadError = null, publicUrl = "https://example.com/photo.webp" } =
      opts;
    return {
      storage: {
        from: () => ({
          upload: vi.fn().mockResolvedValue({
            error: uploadError ? { message: uploadError } : null,
          }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl },
          }),
        }),
      },
    };
  }

  it("returns url on successful upload", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = makeMockSupabase({ publicUrl: "https://cdn.example.com/img.webp" }) as any;
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const result = await _uploadToStorage(supabase, file, "token/recipe/photo.webp");
    expect(result).toEqual({ url: "https://cdn.example.com/img.webp" });
  });

  it("returns error when upload fails", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = makeMockSupabase({ uploadError: "Storage quota exceeded" }) as any;
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const result = await _uploadToStorage(supabase, file, "token/recipe/photo.webp");
    expect(result).toEqual({ error: "Storage quota exceeded" });
  });

  it("does not call getPublicUrl when upload fails", async () => {
    const fromResult = {
      upload: vi.fn().mockResolvedValue({ error: { message: "fail" } }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "" } }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = { storage: { from: () => fromResult } } as any;
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    await _uploadToStorage(supabase, file, "token/recipe/photo.webp");
    expect(fromResult.getPublicUrl).not.toHaveBeenCalled();
  });
});
