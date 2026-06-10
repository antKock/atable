// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePhotoUpload } from "./usePhotoUpload";
import { resizeImageToBlob } from "@/lib/image-resize";

vi.mock("@/lib/image-resize", () => ({
  resizeImageToBlob: vi.fn(),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.mocked(resizeImageToBlob).mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeFile(bytes = 4, name = "photo.jpg"): File {
  return new File([new Uint8Array(bytes)], name, { type: "image/jpeg" });
}

describe("uploadPhoto", () => {
  it("resizes then POSTs the photo to the recipe photo endpoint", async () => {
    const resizedBlob = new Blob([new Uint8Array(2)], { type: "image/webp" });
    vi.mocked(resizeImageToBlob).mockResolvedValue({ blob: resizedBlob, ext: "webp" });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ url: "https://cdn.example.com/img.webp?v=1" }), {
        status: 200,
      }),
    );

    const { uploadPhoto } = usePhotoUpload();
    const result = await uploadPhoto(makeFile(), "recipe-123");

    expect(result).toEqual({ url: "https://cdn.example.com/img.webp?v=1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/recipes/recipe-123/photo");
    expect(init.method).toBe("POST");
    const sent = init.body as FormData;
    const sentFile = sent.get("photo") as File;
    // The server derives the extension from the MIME type, not the filename.
    expect(sentFile.type).toBe("image/webp");
  });

  it("falls back to the original file when resizing fails", async () => {
    vi.mocked(resizeImageToBlob).mockRejectedValue(new Error("no canvas"));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ url: "https://cdn.example.com/raw.jpg" }), {
        status: 200,
      }),
    );

    const { uploadPhoto } = usePhotoUpload();
    const result = await uploadPhoto(makeFile(4, "original.jpg"), "recipe-1");

    expect(result).toEqual({ url: "https://cdn.example.com/raw.jpg" });
    const sentFile = (fetchMock.mock.calls[0][1].body as FormData).get("photo") as File;
    expect(sentFile.type).toBe("image/jpeg");
  });

  it("rejects oversized payloads without calling the API", async () => {
    vi.mocked(resizeImageToBlob).mockRejectedValue(new Error("no canvas"));

    const { uploadPhoto } = usePhotoUpload();
    const result = await uploadPhoto(makeFile(4 * 1024 * 1024 + 1), "recipe-1");

    expect(result).toEqual({ error: "La photo est trop volumineuse" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an error when the API call fails", async () => {
    const resizedBlob = new Blob([new Uint8Array(2)], { type: "image/webp" });
    vi.mocked(resizeImageToBlob).mockResolvedValue({ blob: resizedBlob, ext: "webp" });
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));

    const { uploadPhoto } = usePhotoUpload();
    const result = await uploadPhoto(makeFile(), "recipe-1");

    expect(result).toEqual({ error: "La photo n'a pas pu être enregistrée" });
  });
});
