// Org-level OpenAI spend, pulled from the Administration Costs API as a
// ground-truth reconciliation against our own instrumentation (ai_costs).
//
// Requires an admin key (sk-admin-…) in OPENAI_ADMIN_KEY. The key is optional:
// without it (or on any error) this returns null and the dashboard simply
// hides the reconciliation tile — instrumented figures still render.

const COSTS_ENDPOINT = "https://api.openai.com/v1/organization/costs";

/**
 * Total billed OpenAI spend (USD) over the last `days` days, org-wide.
 * Returns null when no admin key is configured or the API call fails.
 */
export async function getBilledOpenAiSpend(days = 30): Promise<number | null> {
  const key = process.env.OPENAI_ADMIN_KEY;
  if (!key) return null;

  const startTime = Math.floor(Date.now() / 1000) - days * 86400;

  try {
    let total = 0;
    let page: string | null = null;
    // The costs endpoint buckets by day and paginates; walk all pages.
    do {
      const url = new URL(COSTS_ENDPOINT);
      url.searchParams.set("start_time", String(startTime));
      url.searchParams.set("bucket_width", "1d");
      url.searchParams.set("limit", "180");
      if (page) url.searchParams.set("page", page);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
        // Don't cache — this is admin-only, low-frequency, and must stay fresh.
        cache: "no-store",
        // Bound the call so a slow Costs API can't hang the dashboard load.
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`costs API ${res.status}`);

      const json = (await res.json()) as {
        data?: { results?: { amount?: { value?: string | number } }[] }[];
        has_more?: boolean;
        next_page?: string | null;
      };

      for (const bucket of json.data ?? []) {
        for (const r of bucket.results ?? []) {
          total += Number(r.amount?.value ?? 0) || 0;
        }
      }
      page = json.has_more ? (json.next_page ?? null) : null;
    } while (page);

    return total;
  } catch (err) {
    console.error("[openai-costs] reconciliation fetch failed:", err);
    return null;
  }
}
