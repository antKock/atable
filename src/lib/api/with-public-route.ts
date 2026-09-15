import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getT } from "@/lib/i18n/server";
import type { FullDictionary } from "@/lib/i18n/types";
import { DEFAULT_MAX_BODY_BYTES, rejectOversizedBody } from "@/lib/body-limit";
import { recordApiCall } from "@/lib/events/api-call";

export type WithPublicRouteOptions = {
  /** Plafond du corps (`content-length`), 1 Mo par défaut — cf. body-limit.ts. */
  maxBodyBytes?: number;
};

/**
 * Socle des routes PUBLIQUES du proxy (créer / rejoindre / chercher un carnet,
 * récupération d'accès, session démo) — pendant de `withOwnerAuth` pour les
 * routes sans session (revue 2026-09-12 : 6 réimplémentations du même
 * wrapper). Fait, dans l'ordre :
 *   1. limite de corps (413) AVANT toute lecture — Traefik ne plafonne pas ;
 *   2. résout le dictionnaire de la langue de l'appareil, passé au handler ;
 *   3. transforme toute erreur non attrapée en 500 générique localisé, loggé
 *      et remonté dans Sentry — jamais le message brut Postgres/Supabase (noms
 *      de contraintes et de colonnes) vers le client.
 * Le rate limiting et la validation restent dans chaque route : ils diffèrent.
 * Émet aussi `api.called` (#28) : anonyme (pas d'owner ici), rattaché à la
 * personne par `anon_id` dès sa première session (vue v_identity).
 */
export function withPublicRoute<Req extends Request, C, Res extends Response>(
  handler: (request: Req, context: C, t: FullDictionary) => Promise<Res>,
  options: WithPublicRouteOptions = {},
) {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  return async (request: Req, context?: C): Promise<Res | NextResponse> => {
    const startedAt = performance.now();
    const respond = async (res: Res | NextResponse) => {
      await recordApiCall({ request, response: res, startedAt });
      return res;
    };
    const t = await getT();
    try {
      const tooLarge = await rejectOversizedBody(request, maxBodyBytes, t);
      if (tooLarge) return tooLarge;
      return await respond(await handler(request, context as C, t));
    } catch (err) {
      Sentry.captureException(err);
      console.error(`[api] ${request.method} ${new URL(request.url).pathname}:`, err);
      return await respond(NextResponse.json({ error: t.api.serverError }, { status: 500 }));
    }
  };
}
