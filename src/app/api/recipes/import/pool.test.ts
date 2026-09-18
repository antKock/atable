import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { POST as postUrl } from "./url/route";
import { POST as postScreenshot } from "./screenshot/route";
import { POST as postVoice } from "./voice/route";
import { enforceImportQuota } from "@/lib/import-quota";
import {
  extractRecipeFromUrl,
  extractRecipeFromImages,
  extractRecipeFromVoice,
  ImportError,
} from "@/lib/import";
import { keepImportSample } from "@/lib/import-pool/samples";

// Câblage de la conservation 30 jours dans les trois routes d'import
// (docs/specs/ocr-appareil/01-conservation-imports.md) : chaque route passe sa
// réponse FINALE, la méthode et ce qu'il faut garder ; la logique (qui, quand,
// plafond, stockage) est testée dans src/lib/import-pool/samples.test.ts.
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/auth/owner-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/owner-context")>();
  const { ownerContextFromTestHeaders } = await import("@/test/owner-context-mock");
  return { ...actual, getOwnerContext: vi.fn(ownerContextFromTestHeaders) };
});
vi.mock("@/lib/import-quota", () => ({ enforceImportQuota: vi.fn() }));
vi.mock("@/lib/import", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/import")>();
  return {
    ...actual,
    extractRecipeFromUrl: vi.fn(),
    extractRecipeFromImages: vi.fn(),
    extractRecipeFromVoice: vi.fn(),
  };
});
// L'en-tête interne du journal est retiré par withOwnerAuth après le handler :
// on le photographie au moment où la route passe la main.
vi.mock("@/lib/import-pool/samples", () => ({
  keepImportSample: vi.fn(
    async (input: { response: NextResponse; eventHeader?: string | null }) => {
      input.eventHeader = input.response.headers.get("x-mijote-event");
      return input.response;
    },
  ),
}));

const RECIPE = { title: "Tarte", ingredients: "pommes", steps: "cuire", notes: null };
const keep = keepImportSample as unknown as Mock;
const lastKeep = () => keep.mock.calls.at(-1)![0];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(enforceImportQuota).mockResolvedValue(null);
  (headers as unknown as Mock).mockResolvedValue(new Headers({ "x-household-id": "hh-1" }));
});

const json = (path: string, body: unknown) =>
  new NextRequest(`https://test.local/api/recipes/import/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("import photo", () => {
  it("passe la réponse et les images DÉCODÉES (telles que reçues)", async () => {
    vi.mocked(extractRecipeFromImages).mockResolvedValue({
      recipe: RECIPE,
      imageKind: "screenshot",
    } as never);
    const png = `data:image/png;base64,${Buffer.from([7, 8, 9]).toString("base64")}`;
    const res = await postScreenshot(json("screenshot", { images: [png, "AQID"] }));
    expect(res.status).toBe(200);
    const input = lastKeep();
    expect(input).toMatchObject({ method: "photo", householdId: "hh-1", imageKind: "screenshot" });
    expect(input.response.status).toBe(200);
    const files = await input.files();
    expect(files).toEqual([
      { name: "1.png", body: Uint8Array.from([7, 8, 9]), contentType: "image/png" },
      { name: "2.jpg", body: Uint8Array.from([1, 2, 3]), contentType: "image/jpeg" },
    ]);
  });

  it("un échec d'extraction passe aussi (422), avec les images", async () => {
    vi.mocked(extractRecipeFromImages).mockRejectedValue(new Error("boom"));
    await postScreenshot(json("screenshot", { images: ["AQID"] }));
    expect(lastKeep().response.status).toBe(422);
    expect(await lastKeep().files()).toHaveLength(1);
  });

  it("corps invalide : rien à garder, la route ne l'appelle pas", async () => {
    await postScreenshot(json("screenshot", { images: [] }));
    expect(keep).not.toHaveBeenCalled();
  });
});

describe("dictée", () => {
  it("passe l'enregistrement tel que reçu et la trace (transcription)", async () => {
    vi.mocked(extractRecipeFromVoice).mockImplementation(async (_audio, meta) => {
      meta!.trace!.transcript = "il faut des pommes";
      return RECIPE as never;
    });
    const form = new FormData();
    form.append("audio", new File([new Uint8Array([4, 5])], "r.mp4", { type: "audio/mp4" }));
    await postVoice(
      new NextRequest("https://test.local/api/recipes/import/voice", {
        method: "POST",
        body: form,
      }),
    );
    const input = lastKeep();
    expect(input).toMatchObject({ method: "voice", trace: { transcript: "il faut des pommes" } });
    expect(await input.files()).toEqual([
      { name: "audio.m4a", body: Uint8Array.from([4, 5]), contentType: "audio/mp4" },
    ]);
  });

  it("TRANSCRIPTION_FAILED passe aussi", async () => {
    vi.mocked(extractRecipeFromVoice).mockRejectedValue(
      new ImportError("vide", "TRANSCRIPTION_FAILED"),
    );
    const form = new FormData();
    form.append("audio", new File([new Uint8Array([1])], "r.webm", { type: "audio/webm" }));
    await postVoice(
      new NextRequest("https://test.local/api/recipes/import/voice", {
        method: "POST",
        body: form,
      }),
    );
    expect(lastKeep().response.status).toBe(422);
  });
});

describe("lien", () => {
  it("passe l'adresse et la trace (texte, voie), aucun fichier en plus", async () => {
    vi.mocked(extractRecipeFromUrl).mockImplementation(async (_url, meta) => {
      meta!.trace!.text = "texte";
      meta!.trace!.path = "import_url";
      return RECIPE as never;
    });
    await postUrl(json("url", { url: "https://example.com/r" }));
    const input = lastKeep();
    expect(input).toMatchObject({
      method: "url",
      url: "https://example.com/r",
      trace: { text: "texte", path: "import_url" },
    });
    expect(await input.files()).toEqual([]);
    // Le complément du journal (site) est déjà posé quand la route passe la main.
    expect(JSON.parse(input.eventHeader)).toMatchObject({
      site: "example.com",
    });
  });

  it("SITE_BLOCKED passe aussi, avec l'adresse (reproduire l'échec sur ce site)", async () => {
    vi.mocked(extractRecipeFromUrl).mockRejectedValue(new ImportError("x", "SITE_BLOCKED"));
    await postUrl(json("url", { url: "https://blocked.example/r" }));
    expect(lastKeep()).toMatchObject({ url: "https://blocked.example/r" });
    expect(lastKeep().response.status).toBe(422);
  });
});
