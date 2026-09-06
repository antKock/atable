import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getRequestOrigin } from "./request-origin";

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

const ORIGINAL_APP_ORIGIN = process.env.APP_ORIGIN;

beforeEach(() => {
  delete process.env.APP_ORIGIN;
});

afterEach(() => {
  if (ORIGINAL_APP_ORIGIN === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = ORIGINAL_APP_ORIGIN;
  vi.restoreAllMocks();
});

describe("getRequestOrigin — APP_ORIGIN (source de vérité)", () => {
  it("APP_ORIGIN prime sur tous les en-têtes, même forgés", () => {
    process.env.APP_ORIGIN = "https://mijote.anthonykocken.fr";
    const r = req("http://0.0.0.0:3000/api/recovery/request", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "attaquant.tld",
      host: "attaquant.tld",
    });
    expect(getRequestOrigin(r)).toBe("https://mijote.anthonykocken.fr");
  });

  it("normalise APP_ORIGIN (slash final, chemin) en origine pure", () => {
    process.env.APP_ORIGIN = "https://staging.mijote.anthonykocken.fr/";
    expect(getRequestOrigin(req("http://0.0.0.0:3000/x"))).toBe(
      "https://staging.mijote.anthonykocken.fr",
    );
  });

  it("APP_ORIGIN invalide → repli sur les en-têtes, avec un warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.APP_ORIGIN = "mijote.anthonykocken.fr"; // pas de schéma
    const r = req("http://0.0.0.0:3000/x", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "mijote.anthonykocken.fr",
    });
    expect(getRequestOrigin(r)).toBe("https://mijote.anthonykocken.fr");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("APP_ORIGIN invalide"));
  });

  it("APP_ORIGIN vide ≡ absente", () => {
    process.env.APP_ORIGIN = "   ";
    const r = req("http://0.0.0.0:3000/x", { host: "mijote.anthonykocken.fr" });
    expect(getRequestOrigin(r)).toBe("http://mijote.anthonykocken.fr");
  });
});

describe("getRequestOrigin — repli sur les en-têtes (sans APP_ORIGIN)", () => {
  it("uses the forwarded proto/host behind a reverse proxy (Traefik)", () => {
    const r = req("http://0.0.0.0:3000/api/recipes/x/share", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "mijote.anthonykocken.fr",
      host: "0.0.0.0:3000",
    });
    expect(getRequestOrigin(r)).toBe("https://mijote.anthonykocken.fr");
  });

  it("conserve le port de x-forwarded-host", () => {
    const r = req("http://0.0.0.0:3000/x", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "mijote.local:8443",
    });
    expect(getRequestOrigin(r)).toBe("https://mijote.local:8443");
  });

  it("respecte x-forwarded-proto: http (proxy sans TLS, ex. stack locale)", () => {
    const r = req("http://0.0.0.0:3000/x", {
      "x-forwarded-proto": "http",
      "x-forwarded-host": "localhost:3000",
    });
    expect(getRequestOrigin(r)).toBe("http://localhost:3000");
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

  // Documente la limite du repli : sans APP_ORIGIN, un Host forgé que le proxy
  // ne réécrit pas devient l'origine des magic links (cf. modèle de menace en
  // tête de request-origin.ts). C'est POURQUOI APP_ORIGIN doit être posée en
  // auto-hébergement — ce test fige le comportement, il ne le cautionne pas.
  it("host usurpé SANS APP_ORIGIN → l'origine suit l'en-tête (d'où APP_ORIGIN obligatoire derrière Traefik)", () => {
    const r = req("http://0.0.0.0:3000/api/recovery/request", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "attaquant.tld",
    });
    expect(getRequestOrigin(r)).toBe("https://attaquant.tld");
  });
});
