import type { NextRequest } from "next/server";

/**
 * Origine publique de l'application (`https://mijote.anthonykocken.fr`), pour
 * construire des liens absolus (magic links, liens de partage).
 *
 * Source de vérité : la variable d'env `APP_ORIGIN` (sans slash final). Si
 * elle est absente ou invalide, repli sur les en-têtes de la requête :
 * `x-forwarded-proto` / `x-forwarded-host` (posés par le reverse proxy), puis
 * `host`, puis `request.nextUrl.origin`.
 *
 * Modèle de menace — pourquoi une variable plutôt que les en-têtes :
 * les magic links (récupération de carnet, #14) sont envoyés par e-mail avec
 * une origine dérivée de la requête. Si un proxy laisse passer un `Host` ou un
 * `x-forwarded-host` forgé par le client (Traefik supprime les `x-forwarded-*`
 * non fiables mais transmet `Host` tel quel : seule sa règle de routage
 * `Host(...)` fait barrage, et un routeur catch-all ou un CDN mal configuré la
 * contourne), un attaquant peut demander un lien
 * de récupération pour la victime : l'e-mail légitime contiendra alors un lien vers
 * `https://attaquant.tld/recovery?token=…` et la victime, en cliquant, livre
 * son token de connexion (empoisonnement de lien par l'en-tête Host).
 * En auto-hébergement (docs/infra/migration-vps-ovh.md), `APP_ORIGIN` coupe
 * court : l'origine ne dépend plus de ce que le client envoie.
 *
 * Derrière un reverse proxy, `request.nextUrl.origin` vaut l'adresse d'écoute
 * du serveur Node (`https://0.0.0.0:3000`) : jamais utilisable directement.
 */
export function getRequestOrigin(request: NextRequest): string {
  const configured = configuredAppOrigin();
  if (configured) return configured;

  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    request.nextUrl.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    request.headers.get("host")?.trim();
  if (!host) return request.nextUrl.origin;
  return `${proto}://${host}`;
}

/**
 * `APP_ORIGIN` validée et normalisée (sans slash final ni chemin), ou `null`
 * si absente/invalide (un warn est loggé une fois par valeur invalide, pour
 * ne pas inonder les logs à chaque requête).
 */
export function configuredAppOrigin(): string | null {
  const raw = process.env.APP_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("scheme");
    return url.origin;
  } catch {
    if (warnedInvalid !== raw) {
      warnedInvalid = raw;
      console.warn(
        `[request-origin] APP_ORIGIN invalide (« ${raw} ») — repli sur les en-têtes de la requête`,
      );
    }
    return null;
  }
}

let warnedInvalid: string | null = null;
