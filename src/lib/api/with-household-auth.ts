import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getOwnerContext } from "@/lib/auth/owner-context";

export type AuthContext = {
  householdId: string;
  sessionId: string | null;
};

/**
 * Shared guard for household-scoped API routes — same signature and observable
 * behaviour as before Lot 0 (chantier foyer), but `householdId` is now resolved
 * in DB via the owner context (session → owner → memberships) instead of the
 * JWT's `hid`, which is vestigial. The single-membership invariant holds until
 * Lot 4; routes migrate to withOwnerAuth progressively in later lots.
 *
 * 401 when the session is unknown/revoked or has no membership; any uncaught
 * error becomes a logged + Sentry-captured generic 500, so route handlers only
 * deal with their domain logic.
 */
export function withHouseholdAuth<Req extends Request, C, Res extends Response>(
  handler: (request: Req, context: C, auth: AuthContext) => Promise<Res>,
) {
  // `context` is optional in the returned signature so tests can call
  // param-less handlers with a single argument; Next always passes both.
  return async (request: Req, context?: C): Promise<Res | NextResponse> => {
    const owner = await getOwnerContext();
    const householdId = owner?.memberships[0]?.householdId;
    if (!owner || !householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      return await handler(request, context as C, {
        householdId,
        sessionId: owner.sessionId,
      });
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
