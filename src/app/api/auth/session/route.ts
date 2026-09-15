import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { getRequestOrigin } from "@/lib/request-origin";
import { withApiEvent } from "@/lib/events/api-call";

// Déconnexion — `api.called` (#28) anonyme : la dernière trace d'une personne
// avant de quitter, utile au « dernier écran avant disparition ».
export const DELETE = withApiEvent(async (request: NextRequest) => {
  const response = NextResponse.redirect(new URL("/", getRequestOrigin(request)), {
    status: 303,
  });
  clearSessionCookie(response);
  return response;
});
