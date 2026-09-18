import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { redis } from "@/lib/redis";
import {
  awaitDeviceCaption,
  decodeDeviceBody,
  isDeviceRef,
  storeDevicePage,
} from "./instagram-device";

vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(), set: vi.fn() } }));

// Page publique d'un reel public (@marmiton_org), lue sans connexion le 2026-09-18.
const REEL = readFileSync(join(__dirname, "../test/instagram/reel-DCJe4hFIGzC.html"), "utf8");
const REF = "0f8fad5b-d9cb-469f-a165-70867728950e";

beforeEach(() => {
  vi.mocked(redis.get).mockReset();
  vi.mocked(redis.set).mockReset().mockResolvedValue("OK");
});

describe("corps envoyé par l'extension", () => {
  it("référence : UUID seulement", () => {
    expect(isDeviceRef(REF)).toBe(true);
    expect(isDeviceRef("abc")).toBe(false);
    expect(isDeviceRef(null)).toBe(false);
  });

  it("HTML brut ou deflate brut (≈ 4,5× plus léger à envoyer)", () => {
    const packed = deflateRawSync(Buffer.from(REEL));
    expect(packed.byteLength * 3).toBeLessThan(Buffer.byteLength(REEL));
    expect(decodeDeviceBody(packed, "deflate-raw")).toBe(REEL);
    expect(decodeDeviceBody(Buffer.from(REEL), null)).toBe(REEL);
  });

  it("deflate illisible ou bombe de décompression → null", () => {
    expect(decodeDeviceBody(Buffer.from("pas du deflate"), "deflate-raw")).toBeNull();
    const bomb = deflateRawSync(Buffer.alloc(10_000_000, 0x61));
    expect(decodeDeviceBody(bomb, "deflate-raw")).toBeNull();
  });
});

describe("storeDevicePage", () => {
  it("extrait la légende côté serveur, identifiant tiré de og:url, TTL court, NX", async () => {
    const status = await storeDevicePage({ ref: REF, ownerId: "o1", html: REEL, pageUrl: null });
    expect(status).toBe("ok");
    const [key, value, opts] = vi.mocked(redis.set).mock.calls[0];
    expect(key).toBe(`ig:device:${REF}`);
    expect(value).toMatchObject({ ownerId: "o1", code: "DCJe4hFIGzC" });
    expect((value as { caption: string }).caption).toMatch(/^Si tu cherches une idée/);
    expect(opts).toEqual({ ex: 300, nx: true });
  });

  it("page sans légende (mur de connexion) : déposée comme inexploitable, pour ne pas faire attendre l'import", async () => {
    const status = await storeDevicePage({
      ref: REF,
      ownerId: "o1",
      html: "<html><head><title>Login</title></head></html>",
      pageUrl: "https://www.instagram.com/reel/DCJe4hFIGzC/",
    });
    expect(status).toBe("unparsable");
    expect(vi.mocked(redis.set).mock.calls[0][1]).toEqual({
      ownerId: "o1",
      code: "DCJe4hFIGzC",
      caption: null,
    });
  });

  it("second envoi pour la même référence : ignoré", async () => {
    vi.mocked(redis.set).mockResolvedValue(null);
    expect(await storeDevicePage({ ref: REF, ownerId: "o1", html: REEL, pageUrl: null })).toBe(
      "duplicate",
    );
  });
});

describe("awaitDeviceCaption", () => {
  const stored = { ownerId: "o1", code: "DCJe4hFIGzC", caption: "Tarte : pommes, pâte, sucre." };

  it("dépôt présent, même personne, même reel → légende", async () => {
    vi.mocked(redis.get).mockResolvedValue(stored);
    expect(await awaitDeviceCaption({ ref: REF, ownerId: "o1", code: "DCJe4hFIGzC" })).toEqual({
      ok: true,
      caption: stored.caption,
      code: "DCJe4hFIGzC",
    });
  });

  it("dépôt arrivé pendant l'attente → légende", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null).mockResolvedValueOnce(stored);
    const got = await awaitDeviceCaption({ ref: REF, ownerId: "o1", code: null, waitMs: 1000 });
    expect(got.ok).toBe(true);
    expect(redis.get).toHaveBeenCalledTimes(2);
  });

  it("autre personne ou autre reel → mismatch (jamais la légende d'un autre)", async () => {
    vi.mocked(redis.get).mockResolvedValue(stored);
    expect(await awaitDeviceCaption({ ref: REF, ownerId: "o2", code: "DCJe4hFIGzC" })).toEqual({
      ok: false,
      miss: "mismatch",
    });
    expect(await awaitDeviceCaption({ ref: REF, ownerId: "o1", code: "Cn6qcPXrOiz" })).toEqual({
      ok: false,
      miss: "mismatch",
    });
  });

  it("page inexploitable → unparsable, sans attendre", async () => {
    vi.mocked(redis.get).mockResolvedValue({ ...stored, caption: null });
    expect(await awaitDeviceCaption({ ref: REF, ownerId: "o1", code: null })).toEqual({
      ok: false,
      miss: "unparsable",
    });
    expect(redis.get).toHaveBeenCalledTimes(1);
  });

  it("rien dans le délai → absent ; Redis en panne → error", async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    expect(await awaitDeviceCaption({ ref: REF, ownerId: "o1", code: null, waitMs: 300 })).toEqual({
      ok: false,
      miss: "absent",
    });
    vi.mocked(redis.get).mockRejectedValue(new Error("down"));
    expect(await awaitDeviceCaption({ ref: REF, ownerId: "o1", code: null })).toEqual({
      ok: false,
      miss: "error",
    });
  });
});
