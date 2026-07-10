import { describe, it, expect } from "vitest";
import {
  generateMagicToken,
  generateRecoveryCode,
  sha256Hex,
  LOGIN_TOKEN_TTL_MS,
  LOGIN_CODE_MAX_ATTEMPTS,
} from "./login-token";
import { UNAMBIGUOUS_ALPHABET } from "./share-token";

describe("generateMagicToken", () => {
  it("16 caractères, tous dans l'alphabet sans ambiguïté", () => {
    for (let i = 0; i < 50; i++) {
      const token = generateMagicToken();
      expect(token).toHaveLength(16);
      for (const char of token) {
        expect(UNAMBIGUOUS_ALPHABET).toContain(char);
      }
    }
  });

  it("ne se répète pas (sanité entropie)", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateMagicToken));
    expect(tokens.size).toBe(200);
  });
});

describe("generateRecoveryCode", () => {
  it("toujours 6 chiffres, zéros de tête compris", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateRecoveryCode()).toMatch(/^\d{6}$/);
    }
  });

  it("disperse sur la plage (sanité, pas un test statistique)", () => {
    const codes = new Set(Array.from({ length: 300 }, generateRecoveryCode));
    expect(codes.size).toBeGreaterThan(290);
  });
});

describe("sha256Hex", () => {
  it("vecteur connu (FIPS 180-2 « abc »)", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("déterministe et en hex minuscule 64 chars", async () => {
    const a = await sha256Hex("482913");
    expect(a).toBe(await sha256Hex("482913"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("constantes du contrat", () => {
  it("TTL 15 min, 5 essais max (valeurs de la spec)", () => {
    expect(LOGIN_TOKEN_TTL_MS).toBe(15 * 60 * 1000);
    expect(LOGIN_CODE_MAX_ATTEMPTS).toBe(5);
  });
});
