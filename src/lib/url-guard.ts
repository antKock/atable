import { lookup } from "node:dns/promises";

// SSRF guard for server-side fetches of user-supplied URLs: the import
// pipeline must never be able to read Vercel-internal or private-network
// endpoints (metadata services, other functions, future internal APIs).
// Known limit: DNS is resolved here then again by fetch (TOCTOU/rebinding);
// closing that would require pinning the resolved IP via a custom dispatcher.

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

const BLOCKED_HOSTNAME = /^localhost$|\.(localhost|local|internal)$/i;

export function isPrivateIp(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) — check the embedded IPv4.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateIp(mapped[1]);

  if (ip.includes(":")) {
    // IPv6: unspecified/loopback, unique-local fc00::/7, link-local fe80::/10.
    const v6 = ip.toLowerCase();
    return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
  }

  // Anything that isn't a plain dotted quad is treated as private: octal or
  // hex forms (0177.0.0.1) re-parse to addresses we can't vet here. Leading
  // zeros are rejected too — fetch could re-parse them as octal.
  const quad = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!quad) return true;
  const segments = quad.slice(1);
  if (segments.some((s) => s.length > 1 && s.startsWith("0"))) return true;
  const parts = segments.map(Number);
  if (parts.some((n) => n > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local — cloud metadata lives here
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast + reserved
  );
}

/**
 * Throws BlockedUrlError unless the URL is HTTPS and its host resolves only
 * to public addresses. Must be re-checked on every redirect hop.
 */
export async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:") {
    throw new BlockedUrlError(`Blocked protocol: ${url.protocol}`);
  }

  // URL.hostname keeps brackets around IPv6 literals.
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAME.test(hostname)) {
    throw new BlockedUrlError(`Blocked hostname: ${hostname}`);
  }

  // IP literal — no DNS involved.
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) {
    if (isPrivateIp(hostname)) {
      throw new BlockedUrlError(`Blocked IP literal: ${hostname}`);
    }
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new BlockedUrlError(`Cannot resolve host: ${hostname}`);
  }
  // Reject if ANY record is private: an attacker controls their DNS and can
  // mix a public A record with a private one.
  if (addresses.some(({ address }) => isPrivateIp(address))) {
    throw new BlockedUrlError(`Host resolves to a private address: ${hostname}`);
  }
}
