import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getRequestOrigin } from "./request-origin";

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

describe("getRequestOrigin", () => {
  it("uses the forwarded proto/host behind a reverse proxy (Traefik)", () => {
    const r = req("http://0.0.0.0:3000/api/recipes/x/share", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "mijote.anthonykocken.fr",
      host: "0.0.0.0:3000",
    });
    expect(getRequestOrigin(r)).toBe("https://mijote.anthonykocken.fr");
  });

  it("falls back to the Host header when only it is present", () => {
    const r = req("http://0.0.0.0:3000/x", { host: "staging.mijote.anthonykocken.fr" });
    expect(getRequestOrigin(r)).toBe("http://staging.mijote.anthonykocken.fr");
  });

  it("keeps the first value of comma-separated forwarded headers", () => {
    const r = req("http://0.0.0.0:3000/x", {
      "x-forwarded-proto": "https, http",
      "x-forwarded-host": "mijote.anthonykocken.fr, proxy.internal",
    });
    expect(getRequestOrigin(r)).toBe("https://mijote.anthonykocken.fr");
  });

  it("falls back to nextUrl.origin without any host information", () => {
    const r = req("https://mijote.anthonykocken.fr/x");
    expect(getRequestOrigin(r)).toBe("https://mijote.anthonykocken.fr");
  });
});
