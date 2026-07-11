// ---------------------------------------------------------------------------
// Apify integration. Two recipe-import paths lean on Apify, both pay-per-use:
//   • Instagram posts/reels  → apify/instagram-reel-scraper (caption text)
//   • Anti-blocking fallback → apify/website-content-crawler (headless markdown)
// Used only by src/lib/import.ts. Degrades gracefully: with no APIFY_TOKEN set,
// isApifyConfigured() is false and the URL import behaves exactly as before
// (direct fetch only, no Instagram support).
// ---------------------------------------------------------------------------

const APIFY_BASE = "https://api.apify.com/v2";

export const APIFY_ACTORS = {
  instagramReel: "apify/instagram-reel-scraper",
  websiteCrawler: "apify/website-content-crawler",
} as const;

// The Instagram audio transcript is a paid Apify add-on (billed per minute of
// audio, on top of the per-result reel price). Enabled to also capture recipes
// that are narrated in the reel rather than written in the caption.
export const INCLUDE_INSTAGRAM_TRANSCRIPT = true;

// Flat USD estimate per Apify call, mirroring IMAGE_PRICING in ai-cost.ts:
// list-rate approximations so the cost dashboard reflects real Apify spend
// (the actual scrape cost isn't returned per-call). Refine once observed.
export const APIFY_PRICING = {
  instagramReel: 0.003, // ~pay-per-result for one reel
  websiteCrawler: 0.004, // ~one page, browser mode
} as const;

/** Whether the Apify-backed import paths are available. */
export function isApifyConfigured(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
}

/**
 * Run an Apify actor synchronously and return its dataset items.
 *
 * Uses the run-sync-get-dataset-items endpoint so a single request both runs
 * the actor and returns its output — no polling, fits a serverless handler.
 * Throws on any non-2xx; callers map the failure to an ImportError.
 */
export async function runApifyActor<T = unknown>(
  actorId: string,
  input: Record<string, unknown>,
  timeoutMs = 60_000,
): Promise<T[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN not configured");

  // Apify REST paths use `username~actor-name`, not `username/actor-name`.
  const path = actorId.replace("/", "~");
  const res = await fetch(
    `${APIFY_BASE}/acts/${path}/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );

  if (!res.ok) {
    throw new Error(`Apify actor ${actorId} failed: ${res.status}`);
  }
  return (await res.json()) as T[];
}
