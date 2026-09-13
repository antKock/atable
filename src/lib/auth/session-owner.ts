import type { NextRequest } from "next/server";
import { redis } from "@/lib/redis";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth/session";
import { resolveOwnerContext, type OwnerContext } from "@/lib/auth/owner-context";

/**
 * Owner porté par le cookie de session d'une requête sur une route PUBLIQUE du
 * proxy (créer / rejoindre un carnet, consommer un lien de récupération).
 *
 * Sur ces routes le proxy n'injecte pas `x-session-id` et ne fait pas le
 * contrôle de révocation Redis : on refait les deux ici, au même endroit, pour
 * qu'une session révoquée (« Se déconnecter » sur un autre appareil) ne serve
 * jamais de base à un ajout de carnet ni de source de fusion. Avant la revue
 * du 2026-09-12, seul `recovery/consume` faisait ce contrôle.
 *
 * `null` = pas de session exploitable (absente, invalide, révoquée, inconnue).
 * Redis indisponible → on laisse passer (fail-open, comme le proxy) : une
 * panne transitoire ne doit pas casser l'acquisition.
 */
export async function resolveSessionOwnerFromCookie(
  request: NextRequest,
): Promise<OwnerContext | null> {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  const payload = await verifySession(raw);
  if (!payload) return null;
  if (await isSessionRevoked(payload.sid)) return null;
  return resolveOwnerContext(payload.sid);
}

async function isSessionRevoked(sid: string): Promise<boolean> {
  try {
    return Boolean(await redis.get(`revoked:${sid}`));
  } catch (err) {
    console.error("[session-owner] revocation check failed (Redis down?), failing open:", err);
    return false;
  }
}
