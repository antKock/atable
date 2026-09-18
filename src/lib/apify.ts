// ---------------------------------------------------------------------------
// Apify integration. Two recipe-import paths lean on Apify, both as a FALLBACK:
//   • Instagram posts/reels  → apify/instagram-reel-scraper (caption text), only
//     when the direct read of the public pages fails (src/lib/instagram.ts)
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

// The Instagram audio transcript is a paid Apify add-on. Measured at ~$0.048
// per reel (~14× a caption-only import), too expensive for the value — disabled.
// We only use the caption. Flip to true (and request it in the actor input) to
// also capture recipes that are narrated in the reel rather than written.
export const INCLUDE_INSTAGRAM_TRANSCRIPT = false;

// USD recorded per Apify call in ai_costs (one row per REAL call — a counter,
// like the transcription row). The account is on the FREE plan: usage is paid
// by the 5 $/month credit, the actual bill is 0 $ — so 0 here, not the list
// rate (≈ 0.003 $/reel, ≈ 0.004 $/page) the dashboard used to add up. The real
// risk is running OUT of credit (Instagram import broken): that's watched by
// getApifyUsage() → the `apify` light of /api/admin/health (veilleur #27).
// Switching to a paid plan = put the list rates back here.
export const APIFY_PRICING = {
  instagramReel: 0,
  websiteCrawler: 0,
} as const;

/** Credit alert threshold: share of the monthly Apify limit already used. */
export const APIFY_USAGE_ALERT_RATIO = 0.8;

export type ApifyUsage = { usedUsd: number; limitUsd: number; cycleEnd: string | null };

/**
 * Monthly usage of the Apify account (`GET /users/me/limits`). `null` when
 * Apify isn't configured or doesn't answer — best-effort, for the health check.
 */
export async function getApifyUsage(): Promise<ApifyUsage | null> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${APIFY_BASE}/users/me/limits`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: {
        monthlyUsageCycle?: { endAt?: string };
        limits?: { maxMonthlyUsageUsd?: number };
        current?: { monthlyUsageUsd?: number };
      };
    };
    const used = body.data?.current?.monthlyUsageUsd;
    const limit = body.data?.limits?.maxMonthlyUsageUsd;
    if (typeof used !== "number" || typeof limit !== "number") return null;
    return {
      usedUsd: used,
      limitUsd: limit,
      cycleEnd: body.data?.monthlyUsageCycle?.endAt ?? null,
    };
  } catch {
    return null;
  }
}

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
  const res = await fetch(`${APIFY_BASE}/acts/${path}/run-sync-get-dataset-items?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Apify actor ${actorId} failed: ${res.status}`);
  }
  return (await res.json()) as T[];
}
