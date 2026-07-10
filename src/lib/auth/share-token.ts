// Capability token for public recipe-share links (/r/<token>).
//
// 8 characters from a 54-symbol unambiguous alphabet (no 0/O/1/l/I) keeps the
// link short and easy to read aloud while giving ~46 bits of entropy
// (54^8 ≈ 7.2e13) — far beyond enumeration risk for non-sensitive recipe data.
// Collisions are handled by the caller retrying against the unique index.

// Shared with the recovery magic-link tokens (login-token.ts), which need the
// same read-aloud-safe property.
export const UNAMBIGUOUS_ALPHABET =
  "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const ALPHABET = UNAMBIGUOUS_ALPHABET;
const TOKEN_LENGTH = 8;

export function generateShareToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  let token = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return token;
}
