import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runApifyActor, isApifyConfigured } from "./apify";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.stubEnv("APIFY_TOKEN", "tok-123");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("apify", () => {
  it("isApifyConfigured suit APIFY_TOKEN", () => {
    expect(isApifyConfigured()).toBe(true);
    vi.stubEnv("APIFY_TOKEN", "");
    expect(isApifyConfigured()).toBe(false);
  });

  it("runApifyActor : endpoint run-sync-get-dataset-items, id `user~actor`, jeton en query, corps = input", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([{ caption: "x" }]), { status: 200 }),
    );
    const items = await runApifyActor<{ caption: string }>("apify/instagram-reel-scraper", {
      username: ["u"],
    });
    expect(items).toEqual([{ caption: "x" }]);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      "https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items?token=tok-123",
    );
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ username: ["u"] });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("non-2xx → erreur avec le statut ; sans jeton → erreur explicite avant tout fetch", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 502 }));
    await expect(runApifyActor("apify/x", {})).rejects.toThrow("failed: 502");
    vi.stubEnv("APIFY_TOKEN", "");
    await expect(runApifyActor("apify/x", {})).rejects.toThrow("APIFY_TOKEN");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
