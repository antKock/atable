import { NextResponse } from "next/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";

export type AuthContext = {
  householdId: string;
  sessionId: string | null;
};

/**
 * Shared guard for household-scoped API routes: resolves the session headers
 * injected by the middleware (401 when absent) and turns any uncaught error
 * into a logged + Sentry-captured generic 500, so route handlers only deal
 * with their domain logic. Routes keep their own try/catch for errors that
 * map to specific status codes (e.g. import errors).
 */
export function withHouseholdAuth<Req extends Request, C, Res extends Response>(
  handler: (request: Req, context: C, auth: AuthContext) => Promise<Res>,
) {
  // `context` is optional in the returned signature so tests can call
  // param-less handlers with a single argument; Next always passes both.
  return async (request: Req, context?: C): Promise<Res | NextResponse> => {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      return await handler(request, context as C, {
        householdId,
        sessionId: hdrs.get("x-session-id"),
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
