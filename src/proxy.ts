import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
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
  PROBE_COOKIE,
  PROBE_COOKIE_MAX_AGE_S,
  PROBE_INTERNAL_HEADER,
  PROBE_QUERY_PARAM,
  PROBE_REQUEST_HEADER,
  detectProbe,
} from "@/lib/probe";
import {
  ANON_COOKIE,
  ANON_COOKIE_MAX_AGE_S,
  ANON_INTERNAL_HEADER,
  isUuid,
} from "@/lib/events/catalog";
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
  "/api/events",
  "/api/cron/",
  "/api/admin/",
  // Lecture d'un carnet par l'app Bien : Bearer BIEN_API_SECRET vérifié dans la route.
  "/api/carnets/",
];

// Journal des événements (#28) : le lot client est public (la landing n'a pas
// de session) mais veut l'owner s'il existe → seule route publique qui reçoit
// `x-session-id` (sans contrôle de révocation : une session révoquée se résout
// à null en DB, l'événement reste anonyme).
const EVENTS_ROUTE = "/api/events";

// Bot user-agents used by social platforms to generate link previews
const BOT_UA_PATTERN =
  /facebookexternalhit|facebookcatalog|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot/i;

let lastRedisReportAt = 0;
function reportRedisFailOpen(err: unknown): void {
  const now = Date.now();
  if (now - lastRedisReportAt < 60_000) return;
  lastRedisReportAt = now;
  Sentry.captureException(err, {
    level: "warning",
    fingerprint: ["proxy-redis-fail-open"],
    tags: { feature: "proxy", check: "redis-revocation" },
    extra: { effect: "révocation de session ignorée (fail open)" },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // La landing est entièrement cliente : aucune server action n'y est postée
  // (la seule du repo vit sur /admin/sante). Les `POST /` observés sont des
  // scanners de la faille « server actions » de Next — sans cookie ni en-tête
  // `Next-Action`, UA Chrome falsifié. Laissés passer, ils finissent en 500
  // « Failed to find Server Action » : bruit Sentry, et le voyant Bord du
  // veilleur (max 2 réponses 5xx sur 2 jours) vire au rouge pour rien.
  // Coupé ici, avant toute autre logique : pas de rendu, pas de cookie A/B,
  // et un 405 que le veilleur ne compte pas.
  if (pathname === "/" && request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  // Let social media crawlers through so they can read OG metadata
  const userAgent = request.headers.get("user-agent") || "";
  if (BOT_UA_PATTERN.test(userAgent)) {
    return NextResponse.next();
  }

  // Sondes (#26) : cookie `mijote_probe`, en-tête `x-mijote-probe`, ou `?probe=1`
  // sur la landing (pose le cookie). Traduit en `x-probe: 1` sur la requête
  // interne — le seul en-tête lu par le code serveur ; un `x-probe` venu du
  // client est retiré, la décision appartient au proxy.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(PROBE_INTERNAL_HEADER);
  const probe = detectProbe({
    cookie: request.cookies.get(PROBE_COOKIE)?.value,
    header: request.headers.get(PROBE_REQUEST_HEADER),
    // `?probe=1` sur toute page (pas seulement la landing) : le shell iOS ne
    // peut pas taper d'URL, mais un lien universel (/join/…?probe=1) l'ouvre.
    queryParam: pathname.startsWith("/api/")
      ? null
      : request.nextUrl.searchParams.get(PROBE_QUERY_PARAM),
  });
  if (probe.probe) requestHeaders.set(PROBE_INTERNAL_HEADER, "1");

  // Identité anonyme des événements produit (#28) : cookie appareil `mijote_aid`
  // posé à la première requête, quel que soit le point d'entrée (/, /join,
  // /r/…). Traduit en `x-anon-id` sur la requête interne — seul en-tête lu par
  // le serveur ; un `x-anon-id` venu du client est retiré. Le shell natif a son
  // propre cookie jar → un identifiant par installation.
  requestHeaders.delete(ANON_INTERNAL_HEADER);
  const anonCookie = request.cookies.get(ANON_COOKIE)?.value;
  const anonId = isUuid(anonCookie) ? anonCookie : crypto.randomUUID();
  const anonFresh = anonId !== anonCookie;
  requestHeaders.set(ANON_INTERNAL_HEADER, anonId);

  const withProbeCookie = (response: NextResponse) => {
    if (probe.setCookie) {
      response.cookies.set({
        name: PROBE_COOKIE,
        value: "1",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: PROBE_COOKIE_MAX_AGE_S,
        path: "/",
      });
    }
    if (anonFresh) {
      response.cookies.set({
        name: ANON_COOKIE,
        value: anonId,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ANON_COOKIE_MAX_AGE_S,
        path: "/",
      });
    }
    return response;
  };

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
    return withProbeCookie(NextResponse.redirect(new URL("/home", getRequestOrigin(request))));
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
      requestHeaders.set(AB_ONBOARDING_HEADER, assignment.variant);
      // Une sonde voit son bras (cookie posé) mais n'est jamais comptée.
      if (assignment.fresh && !probe.probe) requestHeaders.set(AB_ONBOARDING_FRESH_HEADER, "1");
      const response = withProbeCookie(NextResponse.next({ request: { headers: requestHeaders } }));
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
      return withProbeCookie(NextResponse.redirect(new URL("/", getRequestOrigin(request))));
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
      // Redis unavailable → fail open, let the request through. Ce cas ÉTEINT
      // la révocation de session et, ailleurs, le rate limit : il doit être vu
      // (#27). Remonté à Sentry au plus une fois par minute par instance (un
      // Redis en panne = une requête sur chaque page, Sentry n'a pas à tout voir).
      console.error("[proxy] revocation check failed (Redis down?), failing open:", err);
      reportRedisFailOpen(err);
    }

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

    return withProbeCookie(response);
  }

  if (pathname === EVENTS_ROUTE && payload) {
    requestHeaders.set("x-session-id", payload.sid);
  }

  return withProbeCookie(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|.*\\..*).*)",
  ],
};
