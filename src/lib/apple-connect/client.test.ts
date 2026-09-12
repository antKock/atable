import { describe, it, expect, vi } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  makeToken,
  credentialsFromEnv,
  createAppleConnectClient,
  findOngoingRequestId,
  findReportId,
  listDailyInstances,
  type FetchLike,
} from "./client";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const CREDS = {
  key: (privateKey.export({ format: "der", type: "pkcs8" }) as Buffer).toString("base64"),
  keyId: "KEY123",
  issuerId: "issuer-uuid",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("makeToken", () => {
  it("produit un JWT ES256 signé (ieee-p1363) avec kid, iss, aud et 15 min de validité", () => {
    const token = makeToken(CREDS, 1_700_000_000);
    const [h, p, s] = token.split(".");
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(header).toEqual({ alg: "ES256", kid: "KEY123", typ: "JWT" });
    expect(payload).toEqual({ iss: "issuer-uuid", iat: 1_700_000_000, exp: 1_700_000_900, aud: "appstoreconnect-v1" });
    const ok = createVerify("SHA256")
      .update(`${h}.${p}`)
      .verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
    expect(ok).toBe(true);
  });
});

describe("credentialsFromEnv", () => {
  it("lève si une variable manque", () => {
    expect(() => credentialsFromEnv({ APPLE_CONNECT_KEY: "x", APPLE_CONNECT_KEY_ID: "y" })).toThrow(/APPLE_CONNECT/);
  });
  it("lit les trois variables", () => {
    expect(
      credentialsFromEnv({ APPLE_CONNECT_KEY: "k", APPLE_CONNECT_KEY_ID: "id", APPLE_CONNECT_ISSUER_ID: "iss" }),
    ).toEqual({ key: "k", keyId: "id", issuerId: "iss" });
  });
});

describe("createAppleConnectClient.api", () => {
  it("envoie le Bearer vers l'API et parse la réponse", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ data: [] }));
    const client = createAppleConnectClient(CREDS, fetchImpl);
    await expect(client.api("/v1/apps")).resolves.toEqual({ data: [] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.appstoreconnect.apple.com/v1/apps");
    expect((init?.headers as Record<string, string>).Authorization).toMatch(/^Bearer ey/);
  });

  it("refuse tout autre hôte (le jeton ne fuit pas)", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    const client = createAppleConnectClient(CREDS, fetchImpl);
    await expect(client.api("https://evil.example/v1/apps")).rejects.toThrow(/hôte refusé/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("lève sur une réponse non-2xx avec le corps", async () => {
    const client = createAppleConnectClient(CREDS, async () => new Response("nope", { status: 403, statusText: "Forbidden" }));
    await expect(client.api("/v1/apps")).rejects.toThrow(/403 Forbidden — nope/);
  });
});

describe("createAppleConnectClient.downloadInstance", () => {
  it("télécharge chaque segment sans jeton et décompresse le TSV", async () => {
    const fetchImpl = vi.fn<FetchLike>(async (url, init) => {
      if (url.includes("/segments")) {
        return jsonResponse({ data: [{ attributes: { url: "https://s3.example/a.gz" } }, { attributes: { url: "https://s3.example/b.gz" } }] });
      }
      expect(init).toBeUndefined();
      const body = url.endsWith("a.gz") ? "Date\tCounts\n2026-09-09\t1\n" : "Date\tCounts\n2026-09-09\t2\n";
      return new Response(gzipSync(Buffer.from(body)));
    });
    const client = createAppleConnectClient(CREDS, fetchImpl);
    const tsv = await client.downloadInstance("inst-1");
    expect(tsv).toBe("Date\tCounts\n2026-09-09\t1\nDate\tCounts\n2026-09-09\t2\n");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe("découverte des rapports", () => {
  const client = createAppleConnectClient(CREDS, async (url) => {
    if (url.includes("/analyticsReportRequests?") || url.endsWith("/analyticsReportRequests")) {
      return jsonResponse({
        data: [
          { id: "snap", attributes: { accessType: "ONE_TIME_SNAPSHOT", stoppedDueToInactivity: false } },
          { id: "old", attributes: { accessType: "ONGOING", stoppedDueToInactivity: true } },
          { id: "live", attributes: { accessType: "ONGOING", stoppedDueToInactivity: false } },
        ],
      });
    }
    if (url.includes("/reports")) {
      return jsonResponse({ data: [{ id: "r3-live", attributes: { name: "App Downloads Standard", category: "COMMERCE" } }] });
    }
    if (url.includes("/instances")) {
      if (!url.includes("page=2")) {
        return jsonResponse({
          data: [
            { id: "i2", attributes: { granularity: "DAILY", processingDate: "2026-09-10" } },
            { id: "w1", attributes: { granularity: "WEEKLY", processingDate: "2026-09-08" } },
          ],
          links: { next: "https://api.appstoreconnect.apple.com/v1/analyticsReports/r3-live/instances?page=2" },
        });
      }
      return jsonResponse({ data: [{ id: "i1", attributes: { granularity: "DAILY", processingDate: "2026-09-09" } }] });
    }
    return jsonResponse({}, 404);
  });

  it("choisit la requête ONGOING active", async () => {
    await expect(findOngoingRequestId(client, "123")).resolves.toBe("live");
  });

  it("retrouve le rapport par son nom exact", async () => {
    await expect(findReportId(client, "live", "App Downloads Standard")).resolves.toBe("r3-live");
    await expect(findReportId(client, "live", "App Sessions Standard")).rejects.toThrow(/introuvable/);
  });

  it("suit la pagination, ne garde que DAILY et trie par date de traitement", async () => {
    const instances = await listDailyInstances(client, "r3-live");
    expect(instances.map((i) => i.id)).toEqual(["i1", "i2"]);
  });
});
