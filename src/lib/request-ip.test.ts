import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getClientIp } from "./request-ip";

describe("getClientIp", () => {
  it("préfère x-real-ip (posé par Vercel et Traefik)", () => {
    const h = new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1, 10.0.0.1" });
    expect(getClientIp(h)).toBe("203.0.113.7");
  });

  it("repli sur le premier élément de x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": " 198.51.100.1 , 10.0.0.1" });
    expect(getClientIp(h)).toBe("198.51.100.1");
  });

  it("127.0.0.1 sans aucun en-tête", () => {
    expect(getClientIp(new Headers())).toBe("127.0.0.1");
  });

  it("ignore un x-real-ip vide", () => {
    const h = new Headers({ "x-real-ip": "  ", "x-forwarded-for": "198.51.100.1" });
    expect(getClientIp(h)).toBe("198.51.100.1");
  });

  it("accepte une NextRequest (ou tout objet portant .headers)", () => {
    const r = new NextRequest("https://test.local/x", { headers: { "x-forwarded-for": "198.51.100.9" } });
    expect(getClientIp(r)).toBe("198.51.100.9");
  });
});
