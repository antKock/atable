// Shared SWR plumbing: a fetcher that surfaces HTTP errors (a 500 or an
// expired session must reach `error`, not masquerade as empty data), and the
// persisted-cache lifecycle helpers used by SWRProvider.

export class FetchError extends Error {
  constructor(public readonly status: number) {
    super(`Request failed with status ${status}`);
    this.name = "FetchError";
  }
}

export async function swrFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new FetchError(res.status);
  return res.json() as Promise<T>;
}

export const SWR_CACHE_KEY = "swr-cache";

// The cache is keyed by URL only ("/api/library"…), not by household: on a
// session transition (join/leave/demo) the persisted entries would leak the
// previous household's recipes to the next one. Dropping the cache before
// navigating closes that; the flag stops the pagehide persist handler from
// re-saving the in-memory map during the very reload that follows.
let dropped = false;

export function dropSwrCache(): void {
  dropped = true;
  try {
    localStorage.removeItem(SWR_CACHE_KEY);
  } catch {
    // Storage unavailable (private mode…) — nothing persisted, nothing to drop.
  }
}

export function isSwrCacheDropped(): boolean {
  return dropped;
}
