// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useWakeLock } from "./useWakeLock";

describe("useWakeLock", () => {
  let mockRelease: ReturnType<typeof vi.fn>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRelease = vi.fn().mockResolvedValue(undefined);
    mockRequest = vi.fn().mockResolvedValue({ release: mockRelease });
    Object.defineProperty(navigator, "wakeLock", {
      value: { request: mockRequest },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Unmount hooks between tests: the visibilitychange listener is attached
    // to the shared document and would otherwise leak across tests.
    cleanup();
    vi.restoreAllMocks();
  });

  it("requests a screen wake lock on mount when supported", async () => {
    renderHook(() => useWakeLock());
    // Allow microtasks to flush
    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith("screen");
    });
  });

  it("releases the wake lock on unmount", async () => {
    const { unmount } = renderHook(() => useWakeLock());
    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalledOnce();
    });
    unmount();
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("re-acquires the wake lock when the page returns to foreground", async () => {
    renderHook(() => useWakeLock());
    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalledOnce();
    });

    // The OS silently released the sentinel while backgrounded; coming back
    // to the foreground must request a fresh one.
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });
  });

  it("does not re-acquire when going to background", async () => {
    const { unmount } = renderHook(() => useWakeLock());
    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalledOnce();
    });

    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(mockRequest).toHaveBeenCalledOnce();
    unmount();
  });

  it("does not throw when Wake Lock API is unavailable (silent fallback)", async () => {
    // Remove wakeLock from navigator
    Object.defineProperty(navigator, "wakeLock", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(() => renderHook(() => useWakeLock())).not.toThrow();
  });

  it("does not throw when request rejects (silent fallback)", async () => {
    mockRequest.mockRejectedValue(new Error("DOMException: Not allowed"));
    expect(() => renderHook(() => useWakeLock())).not.toThrow();
    // Give it time to reject
    await new Promise((r) => setTimeout(r, 10));
  });
});
