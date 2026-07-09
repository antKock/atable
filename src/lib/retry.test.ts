import { describe, it, expect, vi, afterEach } from "vitest";
import { withRetry } from "./retry";
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
    const fn = vi
      .fn()
      .mockRejectedValueOnce(openAIError(500))
      .mockResolvedValueOnce("ok");
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
