// Secrets de la récupération d'accès (#14, Lot 2) : le magic-token (bearer du
// lien /recover/<token>) et le code 6 chiffres (repli quand les mails sont lus
// sur un autre appareil — cookie jar WKWebView ≠ Safari, ne pas « optimiser »).
//
// Les deux sont HASHÉS au repos (login_tokens.token_hash / code_hash) : le
// clair ne vit que dans l'email. TTL 15 min ; 5 essais de code puis token brûlé.

import { UNAMBIGUOUS_ALPHABET } from "./share-token";

export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;

// 54^16 ≈ 2^92 — bien au-delà des 48 bits minimum de la spec : ce token est un
// bearer d'authentification, pas un simple lien de partage de recette.
const TOKEN_LENGTH = 16;

export function generateMagicToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  let token = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += UNAMBIGUOUS_ALPHABET[bytes[i] % UNAMBIGUOUS_ALPHABET.length];
  }
  return token;
}

// Code 6 chiffres uniforme (rejection sampling : à 5 essais sur 10^6, le
// moindre biais modulo serait le seul angle d'attaque restant).
export function generateRecoveryCode(): string {
  const max = 1_000_000;
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= limit);
  return String(n % max).padStart(6, "0");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
