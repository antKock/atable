// Transient-error detection: HTTP statuses that are worth retrying, plus
// network-level failures which carry no status at all (SDK connection errors,
// undici "fetch failed" TypeErrors, socket error codes, abort timeouts).
// Errors that are neither (ZodError, ImportError, 4xx…) are deterministic —
// retrying them would only re-bill the same failing OpenAI call.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_NAMES = new Set([
  "APIConnectionError", // openai SDK
  "APIConnectionTimeoutError", // openai SDK
  "AbortError",
  "TimeoutError", // AbortSignal.timeout()
]);
const RETRYABLE_CODE = /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|EPIPE|UND_ERR)/;

function isRetryable(error: unknown): boolean {
  const err = error as {
    status?: number;
    name?: string;
    code?: unknown;
    cause?: { code?: unknown; name?: string };
  };
  if (err.status !== undefined) return RETRYABLE_STATUSES.has(err.status);
  if (err.name && RETRYABLE_ERROR_NAMES.has(err.name)) return true;
  const code = err.code ?? err.cause?.code;
  if (typeof code === "string" && RETRYABLE_CODE.test(code)) return true;
  // undici surfaces network failures as TypeError("fetch failed") with the
  // real error in `cause`.
  if (err.name === "TypeError" && err.cause !== undefined) return true;
  return false;
}

// Sur un 429, OpenAI dit quand revenir (`retry-after-ms` / `retry-after`, en
// secondes) : 12 s mesurés sur le plafond images/min du Tier 1. Le backoff
// 1 s → 2 s retombait dans la même fenêtre et l'image finissait en `failed`.
// On attend le délai annoncé + 1 s de marge, plafonné : au-delà d'une minute,
// c'est une limite longue (quota journalier) qu'aucune attente ne résoudra.
const RETRY_AFTER_MARGIN_MS = 1000;
const RETRY_AFTER_MAX_MS = 60_000;

/** Délai annoncé par un 429 (en-têtes de la réponse), ou null s'il n'y en a pas. */
export function retryAfterMs(error: unknown): number | null {
  const err = error as { status?: number; headers?: unknown };
  if (err.status !== 429 || !err.headers) return null;
  const headers = err.headers as Headers | Record<string, string | undefined>;
  const get = (name: string) =>
    typeof (headers as Headers).get === "function"
      ? (headers as Headers).get(name)
      : (headers as Record<string, string | undefined>)[name];
  const ms = Number(get("retry-after-ms"));
  if (Number.isFinite(ms) && ms > 0) return ms;
  const seconds = Number(get("retry-after"));
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return null;
}

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (attempt === maxRetries - 1) throw error;
      if (!isRetryable(error)) throw error;
      const announced = retryAfterMs(error);
      if (announced !== null && announced > RETRY_AFTER_MAX_MS) throw error;
      const delay =
        announced !== null ? announced + RETRY_AFTER_MARGIN_MS : 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

/**
 * Plafond de durée sur une promesse : rejette avec `onTimeout()` après `ms`.
 * Le travail sous-jacent n'est pas annulé (pas d'AbortSignal transmis) — il
 * s'agit de rendre la main au client avant SON timeout, pas d'économiser l'appel.
 */
export async function withDeadline<T>(
  work: Promise<T>,
  ms: number,
  onTimeout: () => Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), ms);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
