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
});
