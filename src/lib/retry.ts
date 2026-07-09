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

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (attempt === maxRetries - 1) throw error;
      if (!isRetryable(error)) throw error;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error("Unreachable");
}
