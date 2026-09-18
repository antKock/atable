import { describe, it, expect, vi, afterEach } from "vitest";
import { retryAfterMs, withRetry } from "./retry";
import { openAIError } from "@/test/openai-mock";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("withRetry", () => {
  it("returns the result without retrying on first-try success", async () => {
    const fn = vi.fn().mockResolvedValue("done");
    await expect(withRetry(fn)).resolves.toBe("done");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a 500 error then succeeds", async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValueOnce(openAIError(500)).mockResolvedValueOnce("ok");
    const p = withRetry(fn);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it.each([429, 500, 502, 503, 504])("treats status %i as retryable", async (status) => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(openAIError(status))
      .mockResolvedValueOnce("recovered");
    const p = withRetry(fn);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("waits the announced retry-after + 1 s on a 429 (image quota: 12 s)", async () => {
    vi.useFakeTimers();
    const err = Object.assign(openAIError(429), {
      headers: new Headers({ "retry-after": "12", "retry-after-ms": "12000" }),
    });
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce("ok");
    const p = withRetry(fn);
    await vi.advanceTimersByTimeAsync(12_999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up at once when the 429 announces more than a minute (long quota)", async () => {
    const err = Object.assign(openAIError(429), {
      headers: new Headers({ "retry-after": "3600" }),
    });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting all retries", async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValue(openAIError(503));
    const p = withRetry(fn, 3);
    const assertion = expect(p).rejects.toThrow();
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws immediately on a non-retryable status (400)", async () => {
    const fn = vi.fn().mockRejectedValue(openAIError(400));
    await expect(withRetry(fn)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry a plain error without a status (ZodError, ImportError…)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(withRetry(fn)).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it.each(["APIConnectionError", "APIConnectionTimeoutError", "AbortError", "TimeoutError"])(
    "retries a network-level %s (no status)",
    async (name) => {
      vi.useFakeTimers();
      const err = new Error("network");
      err.name = name;
      const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce("recovered");
      const p = withRetry(fn);
      await vi.runAllTimersAsync();
      await expect(p).resolves.toBe("recovered");
      expect(fn).toHaveBeenCalledTimes(2);
    },
  );

  it("retries a socket error code (ECONNRESET)", async () => {
    vi.useFakeTimers();
    const err = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce("recovered");
    const p = withRetry(fn);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries an undici 'fetch failed' TypeError with a cause", async () => {
    vi.useFakeTimers();
    const err = new TypeError("fetch failed", { cause: new Error("ECONNREFUSED") });
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce("recovered");
    const p = withRetry(fn);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 400 even when a cause is present", async () => {
    const err = Object.assign(new Error("bad request"), { status: 400, cause: new Error("x") });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn)).rejects.toThrow("bad request");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("withDeadline", () => {
  it("résout avec la valeur quand le travail finit avant l'échéance", async () => {
    const { withDeadline } = await import("./retry");
    await expect(withDeadline(Promise.resolve("ok"), 1000, () => new Error("late"))).resolves.toBe(
      "ok",
    );
  });

  it("rejette avec l'erreur fournie une fois l'échéance passée", async () => {
    vi.useFakeTimers();
    try {
      const { withDeadline } = await import("./retry");
      const never = new Promise<string>(() => {});
      const p = withDeadline(never, 5_000, () => new Error("late"));
      const assertion = expect(p).rejects.toThrow("late");
      await vi.advanceTimersByTimeAsync(5_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("retryAfterMs", () => {
  it("prefers retry-after-ms, falls back to retry-after seconds", () => {
    const h = (init: Record<string, string>) =>
      Object.assign(openAIError(429), { headers: new Headers(init) });
    expect(retryAfterMs(h({ "retry-after-ms": "12000", "retry-after": "13" }))).toBe(12000);
    expect(retryAfterMs(h({ "retry-after": "12" }))).toBe(12000);
    expect(retryAfterMs(h({}))).toBeNull();
  });

  it("reads a plain header object too", () => {
    const err = Object.assign(openAIError(429), { headers: { "retry-after": "5" } });
    expect(retryAfterMs(err)).toBe(5000);
  });

  it("ignores non-429 errors", () => {
    const err = Object.assign(openAIError(503), { headers: new Headers({ "retry-after": "5" }) });
    expect(retryAfterMs(err)).toBeNull();
  });
});
