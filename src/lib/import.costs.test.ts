import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import openai from "@/lib/openai";
import { extractRecipeFromImages, extractRecipeFromUrl, extractRecipeFromVoice } from "./import";
import { recordAiCost, textCostUsd } from "@/lib/ai-cost";
import { runApifyActor, isApifyConfigured, APIFY_PRICING } from "@/lib/apify";
import { chatCompletion, importResult, MOCK_USAGE } from "@/test/openai-mock";
import { AI_MODELS } from "@/lib/ai-models";
import { getCachedCaption, setCachedCaption } from "@/lib/instagram-cache";
import { awaitDeviceCaption } from "@/lib/instagram-device";
import {
  resetInstagramAlertThrottle,
  type InstagramReadReport,
  type UrlReadReport,
} from "./import";
import * as Sentry from "@sentry/nextjs";

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
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));
vi.mock("@/lib/instagram-device", () => ({
  awaitDeviceCaption: vi.fn(async () => ({ ok: false, miss: "absent" })),
}));
vi.mock("@/lib/instagram-cache", () => ({
  getCachedCaption: vi.fn(async () => null),
  setCachedCaption: vi.fn(async () => {}),
}));
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

describe("Instagram : lecture directe, Apify en secours, cache", () => {
  const IG = "https://www.instagram.com/reel/abc123/?igsh=xyz";
  const EMBED = `<div class="Caption"><a class="CaptionUsername" href="#">compte</a><br />Tarte : pommes, pâte, sucre.<br />Cuire 30 min.<div class="CaptionComments"></div></div>`;
  const OG = `<meta property="og:description" content="12 likes, 1 comments - compte on May 1, 2026: &quot;Tarte : pommes, p&#xe2;te, sucre.\nCuire 30 min.&quot;. " />`;
  const page = (body: string, status = 200) => new Response(body, { status });
  let reports: InstagramReadReport[];
  const meta = () => ({ ...META, onInstagramRead: (r: InstagramReadReport) => reports.push(r) });
  beforeEach(() => {
    reports = [];
    resetInstagramAlertThrottle();
    vi.mocked(getCachedCaption).mockResolvedValue(null);
    mockChat.mockResolvedValue(chatCompletion(importResult()));
  });

  it("page embed lue : aucune ligne Apify, seulement import_instagram ; légende mise en cache", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValueOnce(page(EMBED));
    const result = await extractRecipeFromUrl(IG, meta());
    expect(result.title).toBe("Tarte aux pommes");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "https://www.instagram.com/p/abc123/embed/captioned/",
    );
    expect(runApifyActor).not.toHaveBeenCalled();
    expect(String(mockChat.mock.calls[0][0].messages[1].content)).toContain(
      "Tarte : pommes, pâte, sucre.\nCuire 30 min.",
    );
    expect(costRows()).toMatchObject([{ callType: "import_instagram", model: AI_MODELS.text }]);
    expect(costRows()).toHaveLength(1);
    expect(setCachedCaption).toHaveBeenCalledWith("abc123", {
      caption: "Tarte : pommes, pâte, sucre.\nCuire 30 min.",
      source: "direct_embed",
    });
    expect(reports).toEqual([{ path: "direct_embed", readMs: expect.any(Number) }]);
  });

  it("embed bloqué → og:description de la page du reel", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(page("", 429)).mockResolvedValueOnce(page(OG));
    await extractRecipeFromUrl(IG, meta());
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe("https://www.instagram.com/reel/abc123/");
    expect(runApifyActor).not.toHaveBeenCalled();
    expect(reports).toMatchObject([{ path: "direct_og", fallback: "http_429" }]);
  });

  it("déjà en cache : aucune lecture réseau, voie `cache`", async () => {
    vi.mocked(getCachedCaption).mockResolvedValue({
      caption: "Tarte : pommes, pâte, sucre.",
      source: "apify",
    });
    await extractRecipeFromUrl(IG, meta());
    expect(fetch).not.toHaveBeenCalled();
    expect(runApifyActor).not.toHaveBeenCalled();
    expect(reports).toMatchObject([{ path: "cache" }]);
    expect(costRows()).toHaveLength(1);
  });

  it("lecture directe KO → Apify : une ligne Apify (0 $, plan gratuit) puis import_instagram", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(fetch).mockImplementation(async () => page("<html></html>"));
    vi.mocked(runApifyActor).mockResolvedValue([
      { caption: "Tarte : pommes, pâte, sucre. Cuire 30 min." },
    ]);
    await extractRecipeFromUrl(IG, meta());
    expect(vi.mocked(runApifyActor).mock.calls[0][0]).toBe("apify/instagram-reel-scraper");
    expect(vi.mocked(runApifyActor).mock.calls[0][1]).toMatchObject({
      username: [IG],
      resultsLimit: 1,
    });
    expect(costRows()).toMatchObject([
      { callType: "import_instagram", model: "apify:instagram-reel-scraper", costUsd: 0 },
      { callType: "import_instagram", model: AI_MODELS.text },
    ]);
    expect(APIFY_PRICING.instagramReel).toBe(0);
    expect(setCachedCaption).toHaveBeenCalledWith(
      "abc123",
      expect.objectContaining({ source: "apify" }),
    );
    expect(reports).toMatchObject([{ path: "apify", fallback: "no_caption/no_caption" }]);
  });

  it("blocage : alerte Sentry à la 3e lecture directe KO d'affilée, une seule par 10 min", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(fetch).mockImplementation(async () => page("", 429));
    vi.mocked(runApifyActor).mockResolvedValue([{ caption: "Tarte : pommes, pâte, sucre." }]);
    await extractRecipeFromUrl(IG, meta());
    await extractRecipeFromUrl(IG, meta());
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    await extractRecipeFromUrl(IG, meta());
    await extractRecipeFromUrl(IG, meta());
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    const opts = vi.mocked(Sentry.captureMessage).mock.calls[0][1] as {
      level: string;
      fingerprint: string[];
      tags: Record<string, string>;
    };
    expect(opts.level).toBe("error"); // seul niveau notifié par la règle Sentry
    expect(opts.fingerprint[0]).toBe("instagram-direct-blocked");
    expect(opts.fingerprint[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(opts.tags.ig_fallback).toBe("http_429/http_429");
  });

  it("un succès entre deux échecs remet le compteur à zéro", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(runApifyActor).mockResolvedValue([{ caption: "Tarte : pommes, pâte, sucre." }]);
    const ko = () => vi.mocked(fetch).mockImplementation(async () => page("", 429));
    ko();
    await extractRecipeFromUrl(IG, meta());
    await extractRecipeFromUrl(IG, meta());
    vi.mocked(fetch).mockImplementation(async () => page(EMBED));
    await extractRecipeFromUrl(IG, meta());
    ko();
    await extractRecipeFromUrl(IG, meta());
    await extractRecipeFromUrl(IG, meta());
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("lecture directe réussie ou URL non reconnue : aucune alerte", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValueOnce(page(EMBED));
    await extractRecipeFromUrl(IG, meta());
    vi.mocked(runApifyActor).mockResolvedValue([{ caption: "Une recette de tarte aux pommes." }]);
    await extractRecipeFromUrl("https://www.instagram.com/marmiton_org/", meta());
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("URL non reconnue (profil) : Apify directement, raison `unsupported_url`", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(runApifyActor).mockResolvedValue([{ caption: "Une recette de tarte aux pommes." }]);
    await extractRecipeFromUrl("https://www.instagram.com/marmiton_org/", meta());
    expect(fetch).not.toHaveBeenCalled();
    expect(setCachedCaption).not.toHaveBeenCalled();
    expect(reports).toMatchObject([{ path: "apify", fallback: "unsupported_url" }]);
  });

  it("direct KO sans APIFY_TOKEN : SITE_UNREACHABLE, voie `failed`", async () => {
    vi.mocked(fetch).mockResolvedValue(page("", 429));
    await expect(extractRecipeFromUrl(IG, meta())).rejects.toMatchObject({
      code: "SITE_UNREACHABLE",
    });
    expect(runApifyActor).not.toHaveBeenCalled();
    expect(mockChat).not.toHaveBeenCalled();
    expect(reports).toMatchObject([{ path: "failed", fallback: "http_429/http_429" }]);
  });

  it("direct KO et Apify en erreur : SITE_UNREACHABLE, rien facturé", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValue(page("", 500));
    vi.mocked(runApifyActor).mockRejectedValue(new Error("Apify actor failed: 402"));
    await expect(extractRecipeFromUrl(IG, meta())).rejects.toMatchObject({
      code: "SITE_UNREACHABLE",
    });
    expect(recordAiCost).not.toHaveBeenCalled();
    expect(reports).toMatchObject([{ path: "failed" }]);
  });

  it("post sans texte (direct et Apify) : EXTRACTION_FAILED, aucun appel OpenAI", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(fetch).mockImplementation(async () => page("<html></html>"));
    vi.mocked(runApifyActor).mockResolvedValue([{ caption: "   " }]);
    await expect(extractRecipeFromUrl(IG, meta())).rejects.toMatchObject({
      code: "EXTRACTION_FAILED",
    });
    expect(mockChat).not.toHaveBeenCalled();
    expect(costRows()).toHaveLength(1); // l'appel Apify réel reste compté
    expect(reports).toMatchObject([{ path: "failed" }]);
  });

  it("légende directe courte et Apify KO : la légende courte sert quand même", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(fetch)
      .mockResolvedValueOnce(page(`<div class="Caption">Tarte 🍏</div>`))
      .mockResolvedValueOnce(page("", 500));
    vi.mocked(runApifyActor).mockRejectedValue(new Error("Apify actor failed: 402"));
    await extractRecipeFromUrl(IG, meta());
    expect(String(mockChat.mock.calls[0][0].messages[1].content)).toContain("Tarte 🍏");
    expect(reports).toMatchObject([{ path: "direct_embed", fallback: "too_short/http_500" }]);
  });
});

describe("Instagram lu par le téléphone (extension iOS, étape 2)", () => {
  const IG = "https://www.instagram.com/reel/abc123/?igsh=xyz";
  const REF = "0f8fad5b-d9cb-469f-a165-70867728950e";
  let reports: InstagramReadReport[];
  const meta = () => ({
    ...META,
    onInstagramRead: (r: InstagramReadReport) => reports.push(r),
    instagramDevice: { ref: REF, ownerId: "owner-1" },
  });
  beforeEach(() => {
    reports = [];
    resetInstagramAlertThrottle();
    vi.mocked(getCachedCaption).mockResolvedValue(null);
    vi.mocked(awaitDeviceCaption).mockResolvedValue({ ok: false, miss: "absent" });
    mockChat.mockResolvedValue(chatCompletion(importResult()));
  });

  it("page du téléphone disponible : aucune requête du VPS, pas de cache partagé", async () => {
    vi.mocked(awaitDeviceCaption).mockResolvedValue({
      ok: true,
      caption: "Tarte : pommes, pâte, sucre.",
      code: "abc123",
    });
    await extractRecipeFromUrl(IG, meta());
    expect(awaitDeviceCaption).toHaveBeenCalledWith({
      ref: REF,
      ownerId: "owner-1",
      code: "abc123",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(runApifyActor).not.toHaveBeenCalled();
    expect(setCachedCaption).not.toHaveBeenCalled(); // anti-empoisonnement
    expect(String(mockChat.mock.calls[0][0].messages[1].content)).toContain("Tarte : pommes");
    expect(reports).toMatchObject([{ path: "device" }]);
  });

  it("déjà en cache : le cache passe avant l'attente du téléphone", async () => {
    vi.mocked(getCachedCaption).mockResolvedValue({ caption: "Tarte.", source: "direct_embed" });
    await extractRecipeFromUrl(IG, meta());
    expect(awaitDeviceCaption).not.toHaveBeenCalled();
    expect(reports).toMatchObject([{ path: "cache" }]);
  });

  it("rien reçu du téléphone : lecture par le VPS, la raison est gardée", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(`<div class="Caption">Tarte : pommes, pâte, sucre, beurre.</div>`),
    );
    await extractRecipeFromUrl(IG, meta());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reports).toMatchObject([{ path: "direct_embed", device: "absent" }]);
  });

  it("lien court : le téléphone passe AVANT la résolution par le VPS", async () => {
    vi.mocked(awaitDeviceCaption).mockResolvedValue({
      ok: true,
      caption: "Tarte : pommes, pâte, sucre.",
      code: "abc123",
    });
    await extractRecipeFromUrl("https://www.instagram.com/share/reel/BAxyz/", meta());
    expect(awaitDeviceCaption).toHaveBeenCalledWith(expect.objectContaining({ code: null }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sans igref (versions installées) : aucune attente, chaîne de l'étape 1", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(`<div class="Caption">Tarte : pommes, pâte, sucre, beurre.</div>`),
    );
    await extractRecipeFromUrl(IG, { ...META, onInstagramRead: (r) => reports.push(r) });
    expect(awaitDeviceCaption).not.toHaveBeenCalled();
    expect(reports).toMatchObject([{ path: "direct_embed" }]);
    expect(reports[0]).not.toHaveProperty("device");
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

describe("voie de lecture des autres URL (journal)", () => {
  const URL = "https://blocked.example.com/recette";
  const LONG =
    "<h1>Ma Recette</h1><p>farine, œufs, sucre, beurre, lait, sel, et un texte assez long pour dépasser le seuil de contenu minimal du chemin direct, avec des étapes détaillées ligne après ligne pour la préparation de la pâte puis la cuisson au four pendant trente minutes environ.</p>";
  let reports: UrlReadReport[];
  const meta = () => ({ ...META, onUrlRead: (r: UrlReadReport) => reports.push(r) });
  beforeEach(() => {
    reports = [];
    mockChat.mockResolvedValue(chatCompletion(importResult()));
  });

  it("fetch direct OK → direct, sans raison", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(LONG, { status: 200 }));
    await extractRecipeFromUrl(URL, meta());
    expect(reports).toEqual([{ path: "direct", readMs: expect.any(Number) }]);
  });

  it("403 → crawler, raison http_403", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 403 }));
    vi.mocked(runApifyActor).mockResolvedValue([{ markdown: "# Tarte\n- pommes" }]);
    await extractRecipeFromUrl(URL, meta());
    expect(reports).toMatchObject([{ path: "crawler", fallback: "http_403" }]);
  });

  it("page vide sans JS → crawler, raison thin_content", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValue(new Response("<div id='app'></div>", { status: 200 }));
    vi.mocked(runApifyActor).mockResolvedValue([{ text: "Tarte : pommes, pâte" }]);
    await extractRecipeFromUrl(URL, meta());
    expect(reports).toMatchObject([{ path: "crawler", fallback: "thin_content" }]);
  });

  it("délai dépassé puis crawler en erreur → failed, raison timeout", async () => {
    vi.mocked(isApifyConfigured).mockReturnValue(true);
    vi.mocked(fetch).mockRejectedValue(Object.assign(new Error("t"), { name: "TimeoutError" }));
    vi.mocked(runApifyActor).mockRejectedValue(new Error("boom"));
    await expect(extractRecipeFromUrl(URL, meta())).rejects.toMatchObject({
      code: "SITE_UNREACHABLE",
    });
    expect(reports).toMatchObject([{ path: "failed", fallback: "timeout" }]);
  });

  it("sans Apify : 429 → failed, raison http_429, code SITE_BLOCKED inchangé", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 429 }));
    await expect(extractRecipeFromUrl(URL, meta())).rejects.toMatchObject({ code: "SITE_BLOCKED" });
    expect(reports).toMatchObject([{ path: "failed", fallback: "http_429" }]);
  });
});
