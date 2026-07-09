import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getOwnerContext, type OwnerContext } from "@/lib/auth/owner-context";
import { t } from "@/lib/i18n/fr";

/**
 * Guard des routes API à contexte owner (chantier foyer #14 + #15) : résout la
 * session via getOwnerContext (401 si inconnue/révoquée) et transforme toute
 * erreur non attrapée en 500 générique loggé + Sentry, comme withHouseholdAuth
 * — qui est désormais un adaptateur par-dessus ce contexte.
 */
export function withOwnerAuth<Req extends Request, C, Res extends Response>(
  handler: (request: Req, context: C, owner: OwnerContext) => Promise<Res>,
) {
  // `context` optionnel dans la signature retournée : les tests appellent les
  // handlers sans params avec un seul argument ; Next passe toujours les deux.
  return async (request: Req, context?: C): Promise<Res | NextResponse> => {
    const owner = await getOwnerContext();
    if (!owner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      return await handler(request, context as C, owner);
    } catch (err) {
      Sentry.captureException(err);
      console.error(
        `[api] ${request.method} ${new URL(request.url).pathname}:`,
        err,
      );
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  };
}

/**
 * 403 si l'owner n'a pas de membership `member` sur le foyer visé (les invités
 * sont en lecture seule). Posé au Lot 0, branché sur les écritures à partir du
 * Lot 3. Retourne la réponse d'erreur à renvoyer, ou null si OK.
 */
export function requireMember(
  owner: OwnerContext,
  householdId: string,
): NextResponse | null {
  const membership = owner.memberships.find((m) => m.householdId === householdId);
  if (!membership || membership.role !== "member") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Stratégie C (« monde gelé ») : LE garde-fou central démo — 403 sur toute
 * mutation foyer/membership/profil visant le foyer démo. Posé au Lot 0,
 * branché sur les routes au fil des lots. Leçon de l'incident 2026-06 (démo
 * supprimée par ses visiteurs) : garde-fous serveur centralisés, pas éparpillés.
 */
export function assertNotDemoMutation(
  owner: OwnerContext,
  householdId: string,
): NextResponse | null {
  const membership = owner.memberships.find((m) => m.householdId === householdId);
  if (membership?.isDemo) {
    return NextResponse.json({ error: t.demo.frozen }, { status: 403 });
  }
  return null;
}
