import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { t as fr } from "@/lib/i18n/fr";
import { declaredBodyLength, rejectOversizedBody } from "./body-limit";

// getT lit Accept-Language via next/headers : hors requête Next on le remplace
// par le dictionnaire FR.
vi.mock("@/lib/i18n/server", () => ({ getT: vi.fn(async () => fr) }));
const captureMessage = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a) }));

function req(headers: Record<string, string> = {}) {
  return new NextRequest("https://test.local/api/x", { method: "POST", headers });
}

describe("declaredBodyLength", () => {
  it("lit content-length", () => {
    expect(declaredBodyLength(req({ "content-length": "1234" }))).toBe(1234);
  });
  it("null sans content-length (chunked) ou valeur illisible", () => {
    expect(declaredBodyLength(req())).toBeNull();
    expect(declaredBodyLength(req({ "content-length": "abc" }))).toBeNull();
    expect(declaredBodyLength(req({ "content-length": "-1" }))).toBeNull();
  });
});

describe("rejectOversizedBody", () => {
  it("null quand le corps annoncé tient dans la limite (égalité comprise)", async () => {
    expect(await rejectOversizedBody(req({ "content-length": "100" }), 100)).toBeNull();
    expect(await rejectOversizedBody(req({ "content-length": "0" }), 100)).toBeNull();
  });

  it("413 localisé quand le corps annoncé dépasse, et un warning Sentry par route", async () => {
    captureMessage.mockClear();
    const res = await rejectOversizedBody(req({ "content-length": "101" }), 100, fr);
    expect(res?.status).toBe(413);
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage.mock.calls[0][1]).toMatchObject({
      level: "warning",
      fingerprint: ["body-too-large", "/api/x"],
      tags: { route: "/api/x" },
      extra: { declaredBytes: 101, maxBytes: 100, method: "POST" },
    });
    expect(await res!.json()).toEqual({
      error: fr.api.bodyTooLarge,
      code: "BODY_TOO_LARGE",
      maxBytes: 100,
    });
  });

  it("résout le dictionnaire via getT quand `t` n'est pas fourni", async () => {
    const res = await rejectOversizedBody(req({ "content-length": "5000" }), 100);
    expect(res?.status).toBe(413);
    expect((await res!.json()).error).toBe(fr.api.bodyTooLarge);
  });

  it("laisse passer un corps sans content-length (chunked) — documenté, contrôle côté proxy", async () => {
    expect(await rejectOversizedBody(req(), 1)).toBeNull();
  });
});
