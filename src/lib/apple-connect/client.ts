// Client minimal de l'API App Store Connect (JWT ES256 + appels JSON:API +
// téléchargement des instances Analytics Reports).
//
// Partagé entre le cron /api/cron/app-store-sync et le CLI
// scripts/apple-connect.mjs — ce fichier n'a donc AUCUN import relatif ni alias
// `@/` : Node (≥ 22.18, type stripping) l'importe directement en `.ts` depuis le
// script, sans bundler.
//
// Auth : APPLE_CONNECT_KEY (corps base64 de la clé .p8, sans BEGIN/END),
// APPLE_CONNECT_KEY_ID, APPLE_CONNECT_ISSUER_ID. La clé doit avoir le rôle
// Admin (une clé Développeur répond 403 sur les analytics — vérifié 2026-08-16).

import { createPrivateKey, createSign } from "node:crypto";
import { gunzipSync } from "node:zlib";

export const APPLE_CONNECT_API = "https://api.appstoreconnect.apple.com";
const API_HOST = new URL(APPLE_CONNECT_API).host;

export type AppleConnectCredentials = {
  key: string;
  keyId: string;
  issuerId: string;
};

/** Lit les identifiants dans l'environnement ; lève si une variable manque. */
export function credentialsFromEnv(env: Record<string, string | undefined> = process.env): AppleConnectCredentials {
  const { APPLE_CONNECT_KEY, APPLE_CONNECT_KEY_ID, APPLE_CONNECT_ISSUER_ID } = env;
  if (!APPLE_CONNECT_KEY || !APPLE_CONNECT_KEY_ID || !APPLE_CONNECT_ISSUER_ID) {
    throw new Error("Variables APPLE_CONNECT_KEY / APPLE_CONNECT_KEY_ID / APPLE_CONNECT_ISSUER_ID manquantes");
  }
  return { key: APPLE_CONNECT_KEY, keyId: APPLE_CONNECT_KEY_ID, issuerId: APPLE_CONNECT_ISSUER_ID };
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/** JWT App Store Connect (ES256, 15 min), signé avec la clé .p8 (DER pkcs8 en base64). */
export function makeToken(creds: AppleConnectCredentials, now: number = Math.floor(Date.now() / 1000)): string {
  const key = createPrivateKey({
    key: Buffer.from(creds.key, "base64"),
    format: "der",
    type: "pkcs8",
  });
  const header = { alg: "ES256", kid: creds.keyId, typ: "JWT" };
  const payload = { iss: creds.issuerId, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = createSign("SHA256").update(signingInput).sign({ key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(signature)}`;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type AppleConnectClient = {
  /** Appel JSON:API — `path` relatif (`/v1/...`) ou URL absolue vers l'API uniquement. */
  api: <T = unknown>(pathOrUrl: string, init?: { method?: string; body?: unknown }) => Promise<T>;
  /** Télécharge et décompresse tous les segments d'une instance de rapport (TSV concaténé). */
  downloadInstance: (instanceId: string) => Promise<string>;
};

/**
 * Le JWT ne part que vers l'API App Store Connect : une URL absolue vers un
 * autre hôte (lien `next` copié-collé, faute de frappe) ne doit jamais recevoir
 * le Bearer. Les URLs de segments (S3 signées) sont appelées SANS jeton.
 */
export function createAppleConnectClient(
  creds: AppleConnectCredentials,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): AppleConnectClient {
  async function api<T>(pathOrUrl: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${APPLE_CONNECT_API}${pathOrUrl}`;
    const host = new URL(url).host;
    if (host !== API_HOST) {
      throw new Error(`hôte refusé : ${host} (seul ${API_HOST} reçoit le jeton)`);
    }
    const res = await fetchImpl(url, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${makeToken(creds)}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${text}`);
    return (text ? JSON.parse(text) : null) as T;
  }

  async function downloadInstance(instanceId: string): Promise<string> {
    const data = await api<{ data: { attributes: { url: string } }[] }>(
      `/v1/analyticsReportInstances/${instanceId}/segments`,
    );
    let out = "";
    for (const seg of data.data) {
      const res = await fetchImpl(seg.attributes.url);
      if (!res.ok) throw new Error(`segment ${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      out += gunzipSync(buf).toString("utf8");
    }
    return out;
  }

  return { api, downloadInstance };
}

// ---------------------------------------------------------------------------
// Analytics Reports — découverte des rapports du flux ONGOING d'une app.
// ---------------------------------------------------------------------------

export type ReportInstance = { id: string; granularity: string; processingDate: string };

type JsonApiList<A> = { data: { id: string; attributes: A }[]; links?: { next?: string } };

/** Suit les liens `next` d'une collection JSON:API. */
async function listAll<A>(client: AppleConnectClient, firstPath: string): Promise<{ id: string; attributes: A }[]> {
  const out: { id: string; attributes: A }[] = [];
  let next: string | undefined = firstPath;
  while (next) {
    const page: JsonApiList<A> = await client.api<JsonApiList<A>>(next);
    out.push(...page.data);
    next = page.links?.next;
  }
  return out;
}

/** Id de la requête ONGOING (quotidienne) de l'app — la seule voie « données fraîches ». */
export async function findOngoingRequestId(client: AppleConnectClient, appId: string): Promise<string> {
  const requests = await listAll<{ accessType: string; stoppedDueToInactivity: boolean }>(
    client,
    `/v1/apps/${appId}/analyticsReportRequests`,
  );
  const ongoing = requests.find((r) => r.attributes.accessType === "ONGOING" && !r.attributes.stoppedDueToInactivity);
  if (!ongoing) {
    throw new Error(`aucune requête analytics ONGOING active pour l'app ${appId} (analytics-create <appId> ONGOING)`);
  }
  return ongoing.id;
}

/** Id du rapport nommé (ex. « App Downloads Standard ») dans une requête. */
export async function findReportId(client: AppleConnectClient, requestId: string, name: string): Promise<string> {
  const reports = await listAll<{ name: string; category: string }>(
    client,
    `/v1/analyticsReportRequests/${requestId}/reports?filter[name]=${encodeURIComponent(name)}`,
  );
  const report = reports.find((r) => r.attributes.name === name);
  if (!report) throw new Error(`rapport « ${name} » introuvable dans la requête ${requestId}`);
  return report.id;
}

/** Instances DAILY d'un rapport, triées par processingDate croissante. */
export async function listDailyInstances(client: AppleConnectClient, reportId: string): Promise<ReportInstance[]> {
  const instances = await listAll<{ granularity: string; processingDate: string }>(
    client,
    `/v1/analyticsReports/${reportId}/instances?filter[granularity]=DAILY&limit=200`,
  );
  return instances
    .map((i) => ({ id: i.id, granularity: i.attributes.granularity, processingDate: i.attributes.processingDate }))
    .filter((i) => i.granularity === "DAILY")
    .sort((a, b) => a.processingDate.localeCompare(b.processingDate));
}
