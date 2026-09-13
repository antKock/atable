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
import { openAIError } from "@/test/openai-mock";

// Tests des trois voies d'import (revue 2026-09-12) : contrat d'erreur
// `{ error, code }` commun, quota consommé APRÈS validation, invité refusé.
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

const mockHeaders = headers as unknown as Mock;
const IMPORTED = { title: "Tarte", ingredients: "pommes", steps: "cuire", notes: null };

beforeEach(() => {
  vi.mocked(enforceImportQuota).mockReset().mockResolvedValue(null);
  vi.mocked(extractRecipeFromUrl)
    .mockReset()
    .mockResolvedValue(IMPORTED as never);
  vi.mocked(extractRecipeFromImages)
    .mockReset()
    .mockResolvedValue(IMPORTED as never);
  vi.mocked(extractRecipeFromVoice)
    .mockReset()
    .mockResolvedValue(IMPORTED as never);
  mockHeaders.mockResolvedValue(new Headers({ "x-household-id": "household-1" }));
});

function jsonReq(path: string, body: unknown): NextRequest {
  return new NextRequest(`https://test.local/api/recipes/import/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function voiceReq(file: File | null): NextRequest {
  const form = new FormData();
  if (file) form.append("audio", file);
  return new NextRequest("https://test.local/api/recipes/import/voice", {
    method: "POST",
    body: form,
  });
}

const quotaExhausted = () =>
  vi
    .mocked(enforceImportQuota)
    .mockResolvedValue(
      NextResponse.json({ error: "quota", code: "IMPORT_QUOTA" }, { status: 429 }),
    );

describe("POST /api/recipes/import/url", () => {
  it("extrait la recette et consomme le quota du foyer membre", async () => {
    const res = await postUrl(jsonReq("url", { url: "https://example.com/r" }));
    expect(res.status).toBe(200);
    expect(enforceImportQuota).toHaveBeenCalledWith("household-1");
    expect(extractRecipeFromUrl).toHaveBeenCalledWith("https://example.com/r", {
      householdId: "household-1",
    });
  });

  it("une URL invalide répond 400 { error, code } SANS consommer le quota", async () => {
    const res = await postUrl(jsonReq("url", { url: "ftp://nope" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_DATA");
    expect(enforceImportQuota).not.toHaveBeenCalled();
  });

  it("un corps non-JSON répond 400 (pas 500)", async () => {
    const req = new NextRequest("https://test.local/api/recipes/import/url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect((await postUrl(req)).status).toBe(400);
  });

  it("quota épuisé → 429 IMPORT_QUOTA, aucune extraction", async () => {
    quotaExhausted();
    const res = await postUrl(jsonReq("url", { url: "https://example.com/r" }));
    expect(res.status).toBe(429);
    expect(extractRecipeFromUrl).not.toHaveBeenCalled();
  });

  it("un invité (aucun foyer membre) est refusé (403)", async () => {
    const { getOwnerContext } = await import("@/lib/auth/owner-context");
    vi.mocked(getOwnerContext).mockResolvedValueOnce({
      ownerId: "o",
      ownerName: null,
      ownerAlias: null,
      recoveryEmail: null,
      sessionId: "s",
      memberships: [{ householdId: "household-1", role: "guest", isDemo: false }],
    });
    const res = await postUrl(jsonReq("url", { url: "https://example.com/r" }));
    expect(res.status).toBe(403);
    expect(enforceImportQuota).not.toHaveBeenCalled();
  });

  it.each([
    ["SITE_BLOCKED", 422],
    ["SITE_UNREACHABLE", 502],
    ["TIMEOUT", 504],
  ] as const)("ImportError %s → %i avec son code", async (code, status) => {
    vi.mocked(extractRecipeFromUrl).mockRejectedValue(new ImportError("x", code));
    const res = await postUrl(jsonReq("url", { url: "https://example.com/r" }));
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(code);
  });

  it("un 429 OpenAI → RATE_LIMIT", async () => {
    vi.mocked(extractRecipeFromUrl).mockRejectedValue(openAIError(429));
    const res = await postUrl(jsonReq("url", { url: "https://example.com/r" }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMIT");
  });

  it("refuse (413) un corps annoncé au-delà du plafond", async () => {
    const req = new NextRequest("https://test.local/api/recipes/import/url", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(2 * 1024 * 1024) },
    });
    expect((await postUrl(req)).status).toBe(413);
  });
});

describe("POST /api/recipes/import/screenshot", () => {
  const IMG = "data:image/jpeg;base64,/9j/4AAQ";

  it("extrait la recette des images", async () => {
    const res = await postScreenshot(jsonReq("screenshot", { images: [IMG] }));
    expect(res.status).toBe(200);
    expect(enforceImportQuota).toHaveBeenCalledWith("household-1");
  });

  it("un corps invalide répond 400 INVALID_DATA sans consommer le quota", async () => {
    const res = await postScreenshot(jsonReq("screenshot", { images: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_DATA");
    expect(enforceImportQuota).not.toHaveBeenCalled();
  });

  it("un 429 OpenAI porte le code RATE_LIMIT (le client ne mappe que par code)", async () => {
    vi.mocked(extractRecipeFromImages).mockRejectedValue(openAIError(429));
    const res = await postScreenshot(jsonReq("screenshot", { images: [IMG] }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMIT");
  });

  it("toute autre erreur d'extraction → 422 EXTRACTION_FAILED", async () => {
    vi.mocked(extractRecipeFromImages).mockRejectedValue(new Error("boom"));
    const res = await postScreenshot(jsonReq("screenshot", { images: [IMG] }));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("EXTRACTION_FAILED");
  });

  it("quota épuisé → 429, aucune extraction", async () => {
    quotaExhausted();
    const res = await postScreenshot(jsonReq("screenshot", { images: [IMG] }));
    expect(res.status).toBe(429);
    expect(extractRecipeFromImages).not.toHaveBeenCalled();
  });
});

describe("POST /api/recipes/import/voice", () => {
  const audio = (type = "audio/webm", size = 1024) =>
    new File([new Uint8Array(size)], "a.webm", { type });

  it("transcrit et extrait la recette", async () => {
    const res = await postVoice(voiceReq(audio()));
    expect(res.status).toBe(200);
    expect(enforceImportQuota).toHaveBeenCalledWith("household-1");
  });

  it("fichier absent → 400 INVALID_DATA sans consommer le quota", async () => {
    const res = await postVoice(voiceReq(null));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_DATA");
    expect(enforceImportQuota).not.toHaveBeenCalled();
  });

  it("format non supporté → 400 INVALID_DATA", async () => {
    const res = await postVoice(voiceReq(audio("application/pdf")));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_DATA");
  });

  it("quota épuisé → 429, aucune extraction", async () => {
    quotaExhausted();
    const res = await postVoice(voiceReq(audio()));
    expect(res.status).toBe(429);
    expect(extractRecipeFromVoice).not.toHaveBeenCalled();
  });

  it("TRANSCRIPTION_FAILED → 422 avec son code", async () => {
    vi.mocked(extractRecipeFromVoice).mockRejectedValue(
      new ImportError("x", "TRANSCRIPTION_FAILED"),
    );
    const res = await postVoice(voiceReq(audio()));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("TRANSCRIPTION_FAILED");
  });
});
