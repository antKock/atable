import type { NextRequest } from "next/server";

/**
 * Origine publique de la requête (`https://mijote.anthonykocken.fr`), pour
 * construire des liens absolus (magic links, liens de partage).
 *
 * Derrière un reverse proxy (Traefik sur le VPS, cf.
 * docs/infra/migration-vps-ovh.md), `request.nextUrl.origin` vaut l'adresse
 * d'écoute du serveur Node (`https://0.0.0.0:3000`) : les liens seraient faux.
 * Le proxy transmet l'origine réelle dans `x-forwarded-proto` /
 * `x-forwarded-host` ; à défaut on prend `host`. Sur Vercel ces en-têtes sont
 * posés aussi, le résultat est identique à `nextUrl.origin`.
 */
export function getRequestOrigin(request: NextRequest): string {
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    request.nextUrl.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    request.headers.get("host")?.trim();
  if (!host) return request.nextUrl.origin;
  return `${proto}://${host}`;
}
