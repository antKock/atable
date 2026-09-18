import { redis } from "@/lib/redis";

// Cache court de la légende par identifiant de publication : un reel importé
// par plusieurs personnes n'est lu (directement ou via Apify) qu'une fois par
// jour. Contenu public uniquement, jamais de lien avec la personne ni le foyer.
// Best-effort : Redis indisponible = pas de cache, jamais un import en échec.

const PREFIX = "ig:caption:";
export const IG_CACHE_TTL_S = 24 * 3600;

export type CachedCaption = { caption: string; source: "direct_embed" | "direct_og" | "apify" };

export async function getCachedCaption(code: string): Promise<CachedCaption | null> {
  try {
    const hit = await redis.get<CachedCaption>(PREFIX + code);
    return hit && typeof hit.caption === "string" && hit.caption ? hit : null;
  } catch (err) {
    console.error("[instagram] cache read failed:", err);
    return null;
  }
}

export async function setCachedCaption(code: string, value: CachedCaption): Promise<void> {
  try {
    await redis.set(PREFIX + code, value, { ex: IG_CACHE_TTL_S });
  } catch (err) {
    console.error("[instagram] cache write failed:", err);
  }
}
