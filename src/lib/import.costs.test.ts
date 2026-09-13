import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import openai from "@/lib/openai";
import { extractRecipeFromImages, extractRecipeFromUrl, extractRecipeFromVoice } from "./import";
import { recordAiCost, textCostUsd } from "@/lib/ai-cost";
import { runApifyActor, isApifyConfigured, APIFY_PRICING } from "@/lib/apify";
import { chatCompletion, importResult, MOCK_USAGE } from "@/test/openai-mock";
import { AI_MODELS } from "@/lib/ai-models";

// Coût enregistré par voie d'import (revue 2026-09-12 : aucun test ne vérifiait
// `recordAiCost`) + voies Instagram et crawler Apify (zéro test avant).
vi.mock("@/lib/openai", () => ({
  default: {
    chat: { completions: { create: vi.fn() } },
    audio: { transcriptions: { create: vi.fn() } },
    images: { generate: vi.fn() },
  },
}));
vi.mock("@/lib/ai-cost", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-cost")>();
  return { ...actual, recordAiCost: vi.fn(async () => {}) };
});
vi.mock("@/lib/apify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/apify")>();
  return { ...actual, runApifyActor: vi.fn(), isApifyConfigured: vi.fn(() => false) };
});
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
}));

const mockChat = openai.chat.completions.create as unknown as Mock;
const mockTranscribe = openai.audio.transcriptions.create as unknown as Mock;
const META = { householdId: "hh-1" };

const costRows = () => vi.mocked(recordAiCost).mock.calls.map(([r]) => r);
const expectedTextCost = (model: string) =>
  textCostUsd(model, MOCK_USAGE.prompt_tokens, MOCK_USAGE.completion_tokens);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  vi.mocked(isApifyConfigured).mockReturnValue(false);
});
afterEach(() => vi.unstubAllGlobals());

describe("coût enregistré par voie", () => {
  it("ocr : une ligne `ocr` sur le modèle vision avec les tokens de la réponse", async () => {
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    await extractRecipeFromImages(["abc"], META);
    expect(costRows()).toEqual([
      {
        householdId: "hh-1",
        callType: "ocr",
        model: AI_MODELS.vision,
        inputTokens: MOCK_USAGE.prompt_tokens,
        outputTokens: MOCK_USAGE.completion_tokens,
        costUsd: expectedTextCost(AI_MODELS.vision),
      },
    ]);
  });

  it("import_url : une ligne sur le modèle texte", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        "<h1>Ma Recette</h1><p>farine, œufs, sucre, beurre, lait, sel, et un texte assez long pour dépasser le seuil de contenu minimal du chemin direct, avec des étapes détaillées ligne après ligne pour la préparation de la pâte puis la cuisson au four pendant trente minutes environ.</p>",
        { status: 200 },
      ),
    );
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    await extractRecipeFromUrl("https://example.com/r", META);
    expect(costRows()).toMatchObject([
      { callType: "import_url", model: AI_MODELS.text, costUsd: expectedTextCost(AI_MODELS.text) },
    ]);
  });

  it("voix : transcription à 0 $ (compteur) PUIS import_voice sur le modèle texte", async () => {
    mockTranscribe.mockResolvedValue("il faut des pommes");
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    await extractRecipeFromVoice(new File(["x"], "a.webm", { type: "audio/webm" }), META);
    expect(costRows()).toMatchObject([
      { callType: "transcription", model: AI_MODELS.transcription, costUsd: 0 },
      { callType: "import_voice", model: AI_MODELS.text, inputTokens: MOCK_USAGE.prompt_tokens },
    ]);
  });

  it("sans `meta` (tests, appels hors foyer) : aucune ligne de coût", async () => {
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    await extractRecipeFromImages(["abc"]);
    expect(recordAiCost).not.toHaveBeenCalled();
  });

  it("réponse sans `usage` : tokens null, coût 0", async () => {
    mockChat.mockResolvedValue(chatCompletion(importResult(), null));
    await extractRecipeFromImages(["abc"], META);
    expect(costRows()[0]).toMatchObject({ inputTokens: null, outputTokens: null, costUsd: 0 });
  });
});

describe("Instagram (Apify reel scraper)", () => {
  const IG = "https://www.instagram.com/reel/abc123/";

  it("sans APIFY_TOKEN : SITE_UNREACHABLE, aucun fetch direct", async () => {
    await expect(extractRecipeFromUrl(IG, META)).rejects.toMatchObject({
      code: "SITE_UNREACHABLE",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(runApifyActor).not.toHaveBeenCalled();
  });

  it("caption → structuration : coût Apify (forfait) puis import_instagram (tokens)", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(runApifyActor).mockResolvedValue([
      { caption: "Tarte : pommes, pâte, sucre. Cuire 30 min." },
    ]);
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    const result = await extractRecipeFromUrl(IG, META);
    expect(result.title).toBe("Tarte aux pommes");
    expect(vi.mocked(runApifyActor).mock.calls[0][0]).toBe("apify/instagram-reel-scraper");
    expect(vi.mocked(runApifyActor).mock.calls[0][1]).toMatchObject({
      username: [IG],
      resultsLimit: 1,
    });
    expect(String(mockChat.mock.calls[0][0].messages[1].content)).toContain("Tarte : pommes");
    expect(costRows()).toMatchObject([
      {
        callType: "import_instagram",
        model: "apify:instagram-reel-scraper",
        costUsd: APIFY_PRICING.instagramReel,
      },
      { callType: "import_instagram", model: AI_MODELS.text },
    ]);
  });

  it("post sans texte : EXTRACTION_FAILED, aucun appel OpenAI (le scrape est quand même facturé)", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(runApifyActor).mockResolvedValue([{ caption: "   " }]);
    await expect(extractRecipeFromUrl(IG, META)).rejects.toMatchObject({
      code: "EXTRACTION_FAILED",
    });
    expect(mockChat).not.toHaveBeenCalled();
    expect(costRows()).toHaveLength(1);
  });

  it("Apify en erreur : SITE_UNREACHABLE, rien facturé", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(runApifyActor).mockRejectedValue(new Error("Apify actor failed: 500"));
    await expect(extractRecipeFromUrl(IG, META)).rejects.toMatchObject({
      code: "SITE_UNREACHABLE",
    });
    expect(recordAiCost).not.toHaveBeenCalled();
  });
});

describe("crawler Apify (repli du fetch direct)", () => {
  const URL = "https://blocked.example.com/recette";

  it("403 direct → crawler → import_url_crawler ; coût forfaitaire + tokens", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 403 }));
    vi.mocked(runApifyActor).mockResolvedValue([{ markdown: "# Tarte\n- pommes\n- pâte" }]);
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    await extractRecipeFromUrl(URL, META);
    expect(vi.mocked(runApifyActor).mock.calls[0][0]).toBe("apify/website-content-crawler");
    expect(vi.mocked(runApifyActor).mock.calls[0][1]).toMatchObject({
      startUrls: [{ url: URL }],
      maxCrawlPages: 1,
    });
    expect(costRows()).toMatchObject([
      {
        callType: "import_url_crawler",
        model: "apify:website-content-crawler",
        costUsd: APIFY_PRICING.websiteCrawler,
      },
      { callType: "import_url_crawler", model: AI_MODELS.text },
    ]);
  });

  it("page 200 quasi vide (rendu JS) → crawler aussi", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValue(new Response("<div id='app'></div>", { status: 200 }));
    vi.mocked(runApifyActor).mockResolvedValue([{ text: "Tarte aux pommes : pommes, pâte" }]);
    mockChat.mockResolvedValue(chatCompletion(importResult()));
    await extractRecipeFromUrl(URL, META);
    expect(runApifyActor).toHaveBeenCalledTimes(1);
  });

  it("sans Apify configuré : le 403 reste SITE_BLOCKED (comportement historique)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 403 }));
    await expect(extractRecipeFromUrl(URL, META)).rejects.toMatchObject({ code: "SITE_BLOCKED" });
    expect(runApifyActor).not.toHaveBeenCalled();
  });

  it("crawler sans contenu : EXTRACTION_FAILED ; crawler en erreur : SITE_UNREACHABLE", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 403 }));
    vi.mocked(runApifyActor).mockResolvedValueOnce([{}]);
    await expect(extractRecipeFromUrl(URL, META)).rejects.toMatchObject({
      code: "EXTRACTION_FAILED",
    });
    vi.mocked(runApifyActor).mockRejectedValueOnce(new Error("timeout"));
    await expect(extractRecipeFromUrl(URL, META)).rejects.toMatchObject({
      code: "SITE_UNREACHABLE",
    });
  });
});
