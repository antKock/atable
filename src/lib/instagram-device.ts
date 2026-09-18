import { inflateRawSync } from "node:zlib";
import { redis } from "@/lib/redis";
import { extractEmbedCaption, extractOgCaption, parseInstagramUrl } from "@/lib/instagram";

// ---------------------------------------------------------------------------
// Instagram lu PAR LE TÉLÉPHONE (chantier « Instagram sans Apify », étape 2,
// docs/specs/instagram/00-socle.md §2.2). L'extension de partage iOS télécharge
// la page publique partagée depuis la connexion de l'utilisateur, SANS
// l'analyser, et la poste ici avec une référence aléatoire `ref` que l'URL de
// la page d'import transporte aussi (`igref`). Le serveur extrait la légende
// avec le code de l'étape 1 : un changement de format d'Instagram se corrige
// par un push, jamais par une revue App Store.
//
// Anti-empoisonnement : une légende envoyée par un téléphone n'est JAMAIS mise
// dans le cache partagé `ig:caption:*` — elle ne sert qu'à l'import de la même
// personne (ownerId) et du même reel (code), puis expire.
// ---------------------------------------------------------------------------

const PREFIX = "ig:device:";
export const DEVICE_PAGE_TTL_S = 5 * 60;
/** Attente maximale de la page du téléphone par l'import (le page web démarre en parallèle). */
export const DEVICE_WAIT_MS = 3_000;
const DEVICE_POLL_MS = 250;

/** Page brute (≈ 760 Ko) ou compressée deflate brute par l'extension (≈ 170 Ko). */
export const DEVICE_PAGE_MAX_BYTES = 1_500_000;
const DEVICE_PAGE_MAX_INFLATED = 3_000_000;

const REF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isDeviceRef(value: unknown): value is string {
  return typeof value === "string" && REF.test(value);
}

type Stored = { ownerId: string; code: string | null; caption: string | null };

/** Issue du dépôt, pour le journal (enum, jamais de contenu). */
export type DeviceStoreStatus = "ok" | "unparsable" | "duplicate";

/** Corps reçu → HTML (deflate brut si l'extension l'annonce). `null` si illisible ou trop gros. */
export function decodeDeviceBody(body: Buffer, encoding: string | null): string | null {
  try {
    if (encoding === "deflate-raw") {
      const html = inflateRawSync(body, { maxOutputLength: DEVICE_PAGE_MAX_INFLATED });
      return html.toString("utf8");
    }
    return body.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Identifiant de la publication : `og:url` de la page (la vérité après les
 * redirections des liens courts), sinon l'URL finale que l'extension a lue.
 */
function codeOf(html: string, pageUrl: string | null): string | null {
  const og = html.match(/<meta\b[^>]*property="og:url"[^>]*content="([^"]+)"/i)?.[1];
  for (const candidate of [og, pageUrl]) {
    if (!candidate) continue;
    const target = parseInstagramUrl(candidate);
    if (target?.kind === "post") return target.code;
  }
  return null;
}

/** Dépose la légende lue dans la page du téléphone (og:description d'abord, puis embed). */
export async function storeDevicePage(input: {
  ref: string;
  ownerId: string;
  html: string;
  pageUrl: string | null;
}): Promise<DeviceStoreStatus> {
  const caption = extractOgCaption(input.html) ?? extractEmbedCaption(input.html);
  const value: Stored = {
    ownerId: input.ownerId,
    code: codeOf(input.html, input.pageUrl),
    caption,
  };
  // NX : une référence ne sert qu'une fois (pas d'écrasement par un second envoi).
  const set = await redis.set(PREFIX + input.ref, value, { ex: DEVICE_PAGE_TTL_S, nx: true });
  if (set === null) return "duplicate";
  return caption ? "ok" : "unparsable";
}

/** Raison pour laquelle la page du téléphone n'a pas servi (journal, enum). */
export type DeviceMiss = "absent" | "unparsable" | "mismatch" | "error";

/**
 * Attend (≤ DEVICE_WAIT_MS) la légende déposée par le téléphone pour `ref`.
 * `code` = identifiant attendu (null si inconnu, ex. lien court non résolu).
 * Ne lève jamais.
 */
export async function awaitDeviceCaption(input: {
  ref: string;
  ownerId: string;
  code: string | null;
  waitMs?: number;
}): Promise<{ ok: true; caption: string; code: string | null } | { ok: false; miss: DeviceMiss }> {
  const deadline = Date.now() + (input.waitMs ?? DEVICE_WAIT_MS);
  try {
    for (;;) {
      const stored = await redis.get<Stored>(PREFIX + input.ref);
      if (stored) {
        if (stored.ownerId !== input.ownerId) return { ok: false, miss: "mismatch" };
        if (input.code && stored.code && stored.code !== input.code) {
          return { ok: false, miss: "mismatch" };
        }
        if (!stored.caption) return { ok: false, miss: "unparsable" };
        return { ok: true, caption: stored.caption, code: stored.code };
      }
      if (Date.now() + DEVICE_POLL_MS > deadline) return { ok: false, miss: "absent" };
      await new Promise((r) => setTimeout(r, DEVICE_POLL_MS));
    }
  } catch (err) {
    console.error("[instagram] device page read failed:", err);
    return { ok: false, miss: "error" };
  }
}
