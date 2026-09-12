import { describe, it, expect, vi, beforeEach } from "vitest";
import { isPickerCancellation, mediaResultToFile } from "./camera";

vi.mock("@capacitor/core", () => ({
  Capacitor: { convertFileSrc: (uri: string) => `capacitor://localhost/_capacitor_file_${uri}` },
}));

describe("isPickerCancellation", () => {
  it("reconnaît les codes d'annulation du plugin Camera", () => {
    expect(isPickerCancellation({ code: "OS-PLUG-CAMR-0006" })).toBe(true);
    expect(isPickerCancellation({ code: "OS-PLUG-CAMR-0020" })).toBe(true);
    expect(isPickerCancellation({ code: "OS-PLUG-CAMR-0001" })).toBe(false);
  });

  it("repli sur le message (iOS / historique)", () => {
    expect(isPickerCancellation(new Error("User cancelled photos app"))).toBe(true);
    expect(isPickerCancellation(new Error("permission denied"))).toBe(false);
    expect(isPickerCancellation(undefined)).toBe(false);
  });
});

describe("mediaResultToFile", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } })),
    );
  });

  it("lit webPath en priorité et nomme le fichier d'après le type MIME", async () => {
    const file = await mediaResultToFile({ webPath: "blob:x", uri: "file:///y" }, "photo-1");
    expect(file?.name).toBe("photo-1.png");
    expect(file?.type).toBe("image/png");
    expect(fetch).toHaveBeenCalledWith("blob:x");
  });

  it("convertit un uri natif sans webPath", async () => {
    await mediaResultToFile({ uri: "file:///y.jpg" }, "p");
    expect(fetch).toHaveBeenCalledWith("capacitor://localhost/_capacitor_file_file:///y.jpg");
  });

  it("null sans source ou si la lecture échoue", async () => {
    expect(await mediaResultToFile({}, "p")).toBeNull();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("nope"));
    expect(await mediaResultToFile({ webPath: "blob:z" }, "p")).toBeNull();
  });
});
