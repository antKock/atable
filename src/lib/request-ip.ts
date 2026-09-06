/**
 * IP du client, pour les rate limits par IP (recovery, join, partage).
 *
 * Ordre de résolution :
 *   1. `x-real-ip` — posé par Vercel ET par Traefik (Dokploy) avec l'adresse
 *      du pair TCP, donc non forgeable par le client tant que le proxy est le
 *      seul à parler au serveur Node ;
 *   2. premier élément de `x-forwarded-for` (chaîne « client, proxy1, … ») ;
 *   3. `127.0.0.1` (tests, appel direct sans proxy).
 *
 * Limite connue : si un CDN (Cloudflare…) est posé un jour DEVANT Traefik,
 * `x-real-ip` vaudra l'IP du CDN et le premier `x-forwarded-for` restera tel
 * que le client l'a envoyé — forgeable, donc rate limit contournable. Il
 * faudra alors déclarer les plages du CDN dans `forwardedHeaders.trustedIPs`
 * de Traefik (qui réécrit alors XFF/x-real-ip depuis la source de confiance).
 */
export function getClientIp(source: Headers | { headers: Headers }): string {
  const headers = source instanceof Headers ? source : source.headers;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0].trim();
  if (forwarded) return forwarded;
  return "127.0.0.1";
}
