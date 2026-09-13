import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  verifySession,
  signSession,
  setSessionCookie,
  SESSION_RENEW_AFTER_S,
} from "@/lib/auth/session";
import { redis } from "@/lib/redis";
import { getRequestOrigin } from "@/lib/request-origin";
import { isBearerAuthorized } from "@/lib/cron-auth";
import {
  AB_ONBOARDING_COOKIE,
  AB_ONBOARDING_COOKIE_MAX_AGE_S,
  AB_ONBOARDING_FRESH_HEADER,
  AB_ONBOARDING_HEADER,
  isAbOnboardingEnabled,
  resolveAssignment,
} from "@/lib/ab-onboarding";

const ADMIN_API_PREFIX = "/api/admin/";

// Proxy (convention Next 16, ex-`middleware.ts`) : garde d'authentification de
// toutes les routes non publiques — vérifie le cookie de session, la révocation
// Redis, injecte `x-session-id` et renouvelle le jeton (sliding session).
// Tourne sur le runtime Node (le proxy n'a pas de segment `runtime`).

// Exact-match public routes (no session required)
const PUBLIC_ROUTES = ["/", "/support", "/api/households", "/api/version"];
// Prefix-match public routes
const PUBLIC_PREFIXES = [
  "/join/",
  "/r/",
  "/recover/",
  "/api/recovery/",
  "/legal/",
  "/api/households/lookup",
  "/api/households/join",
  "/api/demo/",
  "/api/auth/session",
  "/api/cron/",
  "/api/admin/",
];

// Bot user-agents used by social platforms to generate link previews
const BOT_UA_PATTERN =
  /facebookexternalhit|facebookcatalog|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let social media crawlers through so they can read OG metadata
  const userAgent = request.headers.get("user-agent") || "";
  if (BOT_UA_PATTERN.test(userAgent)) {
    return NextResponse.next();
  }

  // /api/admin/* : préfixe public (pas de session), mais JAMAIS anonyme —
  // toute route admin naît protégée par le secret d'administration
  // (`ADMIN_API_SECRET`, repli `BATCH_ENRICH_SECRET` déjà posé en prod), en
  // plus du contrôle propre à chaque route. Sans secret configuré : tout refusé.
  if (pathname.startsWith(ADMIN_API_PREFIX)) {
    const secret = process.env.ADMIN_API_SECRET || process.env.BATCH_ENRICH_SECRET;
    if (!isBearerAuthorized(request.headers.get("authorization"), secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  const token = request.cookies.get("atable_session")?.value;

  let payload: Awaited<ReturnType<typeof verifySession>> = null;
  if (token) {
    try {
      payload = await verifySession(token);
    } catch {
      payload = null;
    }
  }

  // Authenticated user visiting landing → redirect to /home
  if (pathname === "/" && payload) {
    return NextResponse.redirect(new URL("/home", getRequestOrigin(request)));
  }

  // A/B onboarding (#25) : premier rendu de la landing sans session → bras
  // tiré ici (le seul endroit qui voit la requête ET peut poser un cookie).
  // La page landing lit le bras dans les en-têtes injectés (le cookie n'est
  // pas encore dans la requête) et compte l'affectation si elle est fraîche.
  if (pathname === "/") {
    const assignment = resolveAssignment({
      enabled: isAbOnboardingEnabled(),
      cookie: request.cookies.get(AB_ONBOARDING_COOKIE)?.value,
      ua: userAgent,
    });
    if (assignment) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(AB_ONBOARDING_HEADER, assignment.variant);
      if (assignment.fresh) requestHeaders.set(AB_ONBOARDING_FRESH_HEADER, "1");
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      if (assignment.fresh) {
        response.cookies.set({
          name: AB_ONBOARDING_COOKIE,
          value: assignment.variant,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: AB_ONBOARDING_COOKIE_MAX_AGE_S,
          path: "/",
        });
      }
      return response;
    }
  }

  if (!isPublic) {
    if (!payload) {
      return NextResponse.redirect(new URL("/", getRequestOrigin(request)));
    }

    try {
      const isRevoked = await redis.get(`revoked:${payload.sid}`);
      if (isRevoked) {
        const res = NextResponse.redirect(new URL("/", getRequestOrigin(request)));
        res.cookies.set({
          name: "atable_session",
          value: "",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 0,
          path: "/",
        });
        return res;
      }
    } catch (err) {
      // Redis unavailable → fail open, let the request through
      console.error("[proxy] revocation check failed (Redis down?), failing open:", err);
    }

    const requestHeaders = new Headers(request.headers);
    // Décommissionnement du chantier foyer (Lot 4) : plus de `x-household-id` —
    // le `sid` est l'unique clé, le foyer se résout en DB (owner-context). Seul
    // `x-session-id` est injecté. (Les hints ne dépendent plus de `x-pathname` :
    // ils sont rendus directement dans la page /home via `HomeHints`.)
    requestHeaders.set("x-session-id", payload.sid);
    const response = NextResponse.next({ request: { headers: requestHeaders } });

    // Sliding renewal: re-sign tokens older than the renewal window so active
    // devices never hit the absolute expiry. Only inactivity for the full
    // session lifetime forces re-entering the join code.
    const tokenAgeS = Math.floor(Date.now() / 1000) - payload.iat;
    if (tokenAgeS > SESSION_RENEW_AFTER_S) {
      try {
        const fresh = await signSession({ sid: payload.sid });
        setSessionCookie(response, fresh);
      } catch {
        // Renewal is best-effort; the current token is still valid.
      }
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|.*\\..*).*)",
  ],
};
