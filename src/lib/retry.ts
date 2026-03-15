export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (attempt === maxRetries - 1) throw error;
      const status = (error as { status?: number }).status;
      const isRetryable = status === 429 || status === 500 || status === 503;
      if (!isRetryable) throw error;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error("Unreachable");
}
