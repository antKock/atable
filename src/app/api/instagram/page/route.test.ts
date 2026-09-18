import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { deflateRawSync } from "node:zlib";
import { POST } from "./route";
import { storeDevicePage } from "@/lib/instagram-device";
import { enforceInstagramPageQuota } from "@/lib/import-quota";
import { trackEvent } from "@/lib/events/server";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/auth/owner-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/owner-context")>();
  const { ownerContextFromTestHeaders } = await import("@/test/owner-context-mock");
  return { ...actual, getOwnerContext: vi.fn(ownerContextFromTestHeaders) };
});
vi.mock("@/lib/import-quota", () => ({ enforceInstagramPageQuota: vi.fn() }));
vi.mock("@/lib/events/server", () => ({ trackEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/instagram-device", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/instagram-device")>();
  return { ...actual, storeDevicePage: vi.fn(async () => "ok") };
});

const REF = "0f8fad5b-d9cb-469f-a165-70867728950e";
const HTML = `<meta property="og:description" content="1 likes - x on May 1: &quot;Tarte&quot;." />`;

function req(query: string, body: BodyInit, extra: Record<string, string> = {}) {
  return new NextRequest(`https://test.local/api/instagram/page${query}`, {
    method: "POST",
    headers: { "content-type": "text/html", ...extra },
    body,
  });
}

beforeEach(() => {
  vi.mocked(storeDevicePage).mockClear();
  vi.mocked(enforceInstagramPageQuota).mockReset().mockResolvedValue(null);
  (headers as unknown as Mock).mockResolvedValue(new Headers({ "x-household-id": "household-1" }));
});

describe("POST /api/instagram/page", () => {
  const url = encodeURIComponent("https://www.instagram.com/reel/DCJe4hFIGzC/?igsh=abc");

  it("dépose la page pour l'owner de la session ; seule l'issue va au journal", async () => {
    const res = await POST(req(`?ref=${REF}&url=${url}`, HTML));
    expect(res.status).toBe(200);
    expect(storeDevicePage).toHaveBeenCalledWith({
      ref: REF,
      ownerId: "owner-test",
      html: HTML,
      pageUrl: "https://www.instagram.com/reel/DCJe4hFIGzC/?igsh=abc",
    });
    expect(enforceInstagramPageQuota).toHaveBeenCalledWith("owner-test");
    const props = vi.mocked(trackEvent).mock.calls.at(-1)?.[1];
    expect(props).toMatchObject({ route: "/api/instagram/page", ig_device: "ok" });
    expect(JSON.stringify(props)).not.toMatch(/Tarte|DCJe4hFIGzC/);
  });

  it("corps compressé (deflate brut) décompressé avant extraction", async () => {
    const res = await POST(
      req(`?ref=${REF}`, new Uint8Array(deflateRawSync(Buffer.from(HTML))), {
        "x-mijote-body-encoding": "deflate-raw",
      }),
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(storeDevicePage).mock.calls[0][0]).toMatchObject({
      html: HTML,
      pageUrl: null,
    });
  });

  it("référence invalide → 400 sans rien déposer", async () => {
    const res = await POST(req(`?ref=nope`, HTML));
    expect(res.status).toBe(400);
    expect(storeDevicePage).not.toHaveBeenCalled();
  });

  it("URL hors Instagram ignorée (identifiant pris dans la page seulement)", async () => {
    await POST(req(`?ref=${REF}&url=${encodeURIComponent("https://evil.example/reel/X/")}`, HTML));
    expect(vi.mocked(storeDevicePage).mock.calls[0][0].pageUrl).toBeNull();
  });

  it("corps annoncé > 1,5 Mo → 413 ; quota épuisé → 429", async () => {
    const big = await POST(req(`?ref=${REF}`, HTML, { "content-length": "2000000" }));
    expect(big.status).toBe(413);
    vi.mocked(enforceInstagramPageQuota).mockResolvedValue(
      Response.json({ code: "IG_PAGE_QUOTA" }, { status: 429 }) as never,
    );
    expect((await POST(req(`?ref=${REF}`, HTML))).status).toBe(429);
    expect(storeDevicePage).not.toHaveBeenCalled();
  });
});
