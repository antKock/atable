import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import openai from "@/lib/openai";
import {
  extractRecipeFromImages,
  extractRecipeFromVoice,
  extractRecipeFromUrl,
  ImportError,
} from "./import";
import { chatCompletion, importResult } from "@/test/openai-mock";

vi.mock("@/lib/openai", () => ({
  default: {
    chat: { completions: { create: vi.fn() } },
    audio: { transcriptions: { create: vi.fn() } },
    images: { generate: vi.fn() },
  },
}));

// The SSRF guard resolves hostnames via DNS; keep tests hermetic by always
// resolving to a public address (private-IP cases are covered in url-guard.test.ts).
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
}));

const mockChat = openai.chat.completions.create as unknown as Mock;
const mockTranscribe = openai.audio.transcriptions.create as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// --------------------------------------------------------------------------
// extractRecipeFromImages — screenshot OCR
// --------------------------------------------------------------------------
describe("extractRecipeFromImages", () => {
  it("extracts a recipe from an image", async () => {
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    const result = await extractRecipeFromImages(["base64data"]);
    expect(result.title).toBe("Tarte aux pommes");
    expect(result.prepTime).toBe("20-30 min");
    expect(result.seasons).toEqual(["automne"]);
  });

  it("calls gpt-4o with image_url content", async () => {
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    await extractRecipeFromImages(["base64data"]);
    const request = mockChat.mock.calls[0][0];
    expect(request.model).toBe("gpt-4o");
    const userContent = request.messages[1].content;
    expect(userContent.some((p: { type: string }) => p.type === "image_url")).toBe(
      true,
    );
  });

  it("prefixes raw base64 with a data URI, keeps existing data URIs", async () => {
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    await extractRecipeFromImages([
      "rawbytes",
      "data:image/png;base64,already",
    ]);
    const userContent = mockChat.mock.calls[0][0].messages[1].content;
    const urls = userContent
      .filter((p: { type: string }) => p.type === "image_url")
      .map((p: { image_url: { url: string } }) => p.image_url.url);
    expect(urls[0]).toBe("data:image/jpeg;base64,rawbytes");
    expect(urls[1]).toBe("data:image/png;base64,already");
  });

  it("throws when OpenAI returns empty content", async () => {
    mockChat.mockResolvedValue({ choices: [{ message: { content: null } }] });
    await expect(extractRecipeFromImages(["x"])).rejects.toThrow();
  });

  it("throws when OpenAI returns invalid JSON", async () => {
    mockChat.mockResolvedValue(chatCompletion("this is not json"));
    await expect(extractRecipeFromImages(["x"])).rejects.toThrow();
  });

  it("throws when the response fails schema validation", async () => {
    mockChat.mockResolvedValue(chatCompletion({ title: 123, seasons: [] }));
    await expect(extractRecipeFromImages(["x"])).rejects.toThrow();
  });
});

// --------------------------------------------------------------------------
// List-marker normalisation (applied to every extraction path via toFormData)
// --------------------------------------------------------------------------
describe("list-marker normalisation", () => {
  it("strips leading bullets and dashes from ingredients", async () => {
    mockChat.mockResolvedValue(
      chatCompletion(
        importResult({ ingredients: "- Pommes\n• Pâte brisée\n* Sucre" }),
      ),
    );
    const result = await extractRecipeFromImages(["x"]);
    expect(result.ingredients).toBe("Pommes\nPâte brisée\nSucre");
  });

  it("strips step numbers, 'Étape N' labels and bullets from steps", async () => {
    mockChat.mockResolvedValue(
      chatCompletion(
        importResult({
          steps: "1. Éplucher les pommes\n2) Garnir la pâte\nÉtape 3 : Enfourner",
        }),
      ),
    );
    const result = await extractRecipeFromImages(["x"]);
    expect(result.steps).toBe(
      "Éplucher les pommes\nGarnir la pâte\nEnfourner",
    );
  });

  it("keeps leading quantities in ingredients (does not strip bare numbers)", async () => {
    mockChat.mockResolvedValue(
      chatCompletion(
        importResult({ ingredients: "200 g de farine\n2 oeufs\n- 1 pincée de sel" }),
      ),
    );
    const result = await extractRecipeFromImages(["x"]);
    expect(result.ingredients).toBe("200 g de farine\n2 oeufs\n1 pincée de sel");
  });

  it("drops blank lines left by stripping", async () => {
    mockChat.mockResolvedValue(
      chatCompletion(importResult({ ingredients: "- Pommes\n\n- Sucre\n" })),
    );
    const result = await extractRecipeFromImages(["x"]);
    expect(result.ingredients).toBe("Pommes\nSucre");
  });

  it("keeps '// Nom' section markers untouched in ingredients and steps", async () => {
    mockChat.mockResolvedValue(
      chatCompletion(
        importResult({
          ingredients: "// Pour la pâte\n- Farine\n// Pour la garniture\n- Pommes",
          steps: "// Pour la pâte\n1. Pétrir\n// Pour la garniture\n2. Éplucher",
        }),
      ),
    );
    const result = await extractRecipeFromImages(["x"]);
    expect(result.ingredients).toBe(
      "// Pour la pâte\nFarine\n// Pour la garniture\nPommes",
    );
    expect(result.steps).toBe(
      "// Pour la pâte\nPétrir\n// Pour la garniture\nÉplucher",
    );
  });
});

// --------------------------------------------------------------------------
// Ingredient deduplication (backstop for ingredients read from the steps)
// --------------------------------------------------------------------------
describe("ingredient deduplication", () => {
  it("drops exact duplicates case- and whitespace-insensitively, keeping the first", async () => {
    mockChat.mockResolvedValue(
      chatCompletion(
        importResult({ ingredients: "Sel\n200 g de farine\nsel\n200 g  de farine" }),
      ),
    );
    const result = await extractRecipeFromImages(["x"]);
    expect(result.ingredients).toBe("Sel\n200 g de farine");
  });

  it("keeps lines that differ by quantity", async () => {
    mockChat.mockResolvedValue(
      chatCompletion(importResult({ ingredients: "200 g de farine\nFarine" })),
    );
    const result = await extractRecipeFromImages(["x"]);
    expect(result.ingredients).toBe("200 g de farine\nFarine");
  });

  it("never deduplicates section markers and does not dedupe steps", async () => {
    mockChat.mockResolvedValue(
      chatCompletion(
        importResult({
          ingredients: "// Pâte\nFarine\n// Pâte\nOeufs",
          steps: "Mélanger\nMélanger",
        }),
      ),
    );
    const result = await extractRecipeFromImages(["x"]);
    expect(result.ingredients).toBe("// Pâte\nFarine\n// Pâte\nOeufs");
    expect(result.steps).toBe("Mélanger\nMélanger");
  });
});

// --------------------------------------------------------------------------
// extractRecipeFromVoice — Whisper transcription + structuring
// --------------------------------------------------------------------------
describe("extractRecipeFromVoice", () => {
  const audioFile = () =>
    new File(["fake audio bytes"], "recipe.webm", { type: "audio/webm" });

  it("transcribes audio then structures it into a recipe", async () => {
    mockTranscribe.mockResolvedValue("Pour la tarte il faut des pommes");
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    const result = await extractRecipeFromVoice(audioFile());
    expect(result.title).toBe("Tarte aux pommes");
    expect(mockTranscribe.mock.calls[0][0].model).toBe("whisper-1");
    expect(mockTranscribe.mock.calls[0][0].language).toBe("fr");
    expect(mockChat.mock.calls[0][0].model).toBe("gpt-4o-mini");
  });

  it("throws TRANSCRIPTION_FAILED on an empty transcription", async () => {
    mockTranscribe.mockResolvedValue("");
    const err = await extractRecipeFromVoice(audioFile()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ImportError);
    expect((err as ImportError).code).toBe("TRANSCRIPTION_FAILED");
  });

  it("throws TRANSCRIPTION_FAILED on a whitespace-only transcription", async () => {
    mockTranscribe.mockResolvedValue("   \n  ");
    const err = await extractRecipeFromVoice(audioFile()).catch((e: unknown) => e);
    expect((err as ImportError).code).toBe("TRANSCRIPTION_FAILED");
  });
});

// --------------------------------------------------------------------------
// extractRecipeFromUrl — HTML fetch + cleaning + structuring
// --------------------------------------------------------------------------
describe("extractRecipeFromUrl", () => {
  const mockFetch = () => fetch as unknown as Mock;

  it("fetches the page and extracts a recipe", async () => {
    mockFetch().mockResolvedValue(
      new Response("<h1>Ma Recette</h1>", { status: 200 }),
    );
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    const result = await extractRecipeFromUrl("https://marmiton.org/r/1");
    expect(result.title).toBe("Tarte aux pommes");
  });

  it("strips script and style tags before sending to OpenAI", async () => {
    const html =
      "<html><head><style>.x{color:red}</style></head><body>" +
      '<script>window.alert("tracker-payload")</script>' +
      "<h1>Ma Recette</h1><p>farine</p></body></html>";
    mockFetch().mockResolvedValue(new Response(html, { status: 200 }));
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    await extractRecipeFromUrl("https://marmiton.org/r/1");
    const userContent: string = mockChat.mock.calls[0][0].messages[1].content;
    expect(userContent).not.toContain("<script");
    expect(userContent).not.toContain("tracker-payload");
    expect(userContent).toContain("Ma Recette");
  });

  it("uses gpt-4o-mini", async () => {
    mockFetch().mockResolvedValue(new Response("<h1>R</h1>", { status: 200 }));
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    await extractRecipeFromUrl("https://marmiton.org/r/1");
    expect(mockChat.mock.calls[0][0].model).toBe("gpt-4o-mini");
  });

  it("throws SITE_BLOCKED on HTTP 403", async () => {
    mockFetch().mockResolvedValue(new Response("", { status: 403 }));
    const err = await extractRecipeFromUrl("https://x.com/r").catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ImportError);
    expect((err as ImportError).code).toBe("SITE_BLOCKED");
  });

  it("throws SITE_BLOCKED on HTTP 429", async () => {
    mockFetch().mockResolvedValue(new Response("", { status: 429 }));
    const err = await extractRecipeFromUrl("https://x.com/r").catch(
      (e: unknown) => e,
    );
    expect((err as ImportError).code).toBe("SITE_BLOCKED");
  });

  it("throws SITE_UNREACHABLE on a network error", async () => {
    mockFetch().mockRejectedValue(new Error("ECONNREFUSED"));
    const err = await extractRecipeFromUrl("https://x.com/r").catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ImportError);
    expect((err as ImportError).code).toBe("SITE_UNREACHABLE");
  });

  it("throws SITE_UNREACHABLE on a 500 response", async () => {
    mockFetch().mockResolvedValue(new Response("", { status: 500 }));
    const err = await extractRecipeFromUrl("https://x.com/r").catch(
      (e: unknown) => e,
    );
    expect((err as ImportError).code).toBe("SITE_UNREACHABLE");
  });

  it("blocks a private-IP target before any fetch (SSRF)", async () => {
    const err = await extractRecipeFromUrl("https://169.254.169.254/meta").catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ImportError);
    expect((err as ImportError).code).toBe("SITE_UNREACHABLE");
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("follows a redirect and re-checks the target host", async () => {
    mockFetch()
      .mockResolvedValueOnce(
        new Response(null, { status: 301, headers: { location: "https://x.com/final" } }),
      )
      .mockResolvedValueOnce(new Response("<h1>Ma Recette</h1>", { status: 200 }));
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    const result = await extractRecipeFromUrl("https://x.com/r");
    expect(result.title).toBe("Tarte aux pommes");
    expect(mockFetch().mock.calls[1][0]).toBe("https://x.com/final");
  });

  it("blocks a redirect onto a private address (SSRF via redirect)", async () => {
    mockFetch().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "https://10.0.0.5/internal" } }),
    );
    const err = await extractRecipeFromUrl("https://x.com/r").catch(
      (e: unknown) => e,
    );
    expect((err as ImportError).code).toBe("SITE_UNREACHABLE");
    expect(mockFetch()).toHaveBeenCalledTimes(1);
  });

  it("gives up after too many redirects", async () => {
    mockFetch().mockResolvedValue(
      new Response(null, { status: 301, headers: { location: "https://x.com/loop" } }),
    );
    const err = await extractRecipeFromUrl("https://x.com/r").catch(
      (e: unknown) => e,
    );
    expect((err as ImportError).code).toBe("SITE_UNREACHABLE");
  });
});
