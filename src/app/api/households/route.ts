import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/request-ip";
import { createServerClient } from "@/lib/supabase/server";
import { HouseholdCreateSchema } from "@/lib/schemas/household";
import { generateJoinCode } from "@/lib/auth/join-code";
import { getDeviceName } from "@/lib/auth/device-name";
import { signSession, setSessionCookie } from "@/lib/auth/session";
import { resolveSessionOwnerFromCookie } from "@/lib/auth/session-owner";
import { isDemoOwner } from "@/lib/api/with-owner-auth";
import { resolveDemoTrialStart } from "@/lib/queries/demo-conversion";
import { enforceHouseholdCreateQuota } from "@/lib/import-quota";
import { aliasForOwner } from "@/lib/alias";
import { getLocale } from "@/lib/i18n/server";
import { withPublicRoute } from "@/lib/api/with-public-route";
import { attachNewHouseholdToOwner, provisionOwnerWithHousehold } from "@/lib/db/onboarding";
import { AB_ONBOARDING_COOKIE, variantForNewOwner } from "@/lib/ab-onboarding";

export const POST = withPublicRoute(async (request: NextRequest, _ctx, t) => {
  // Unauthenticated route, and every new household gets a fresh daily
  // import quota — rate limit per IP to keep both bounded.
  const ip = getClientIp(request);
  const quotaResponse = await enforceHouseholdCreateQuota(ip);
  if (quotaResponse) return quotaResponse;

  // Spec #23 : le nom est OPTIONNEL. Absent ou vide → nom par défaut selon la
  // locale de l'appareil (« Mon carnet » / « My cookbook ») ; la personne
  // renomme plus tard depuis le détail du foyer si elle y tient. Un nom
  // fourni (carnet additif depuis le hub) reste validé comme avant.
  const body = (await request.json().catch(() => ({}))) as { name?: unknown } | null;
  const rawName = body?.name;
  const nameOmitted =
    rawName === undefined ||
    rawName === null ||
    (typeof rawName === "string" && rawName.trim() === "");
  let name: string;
  if (nameOmitted) {
    name = t.household.defaultName;
  } else {
    const result = HouseholdCreateSchema.safeParse(rawName);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 422 });
    }
    name = result.data;
  }
  const joinCode = generateJoinCode();
  // Second lien stable pour le rôle invité (Lot 3, décision n°3). Distinct du
  // lien membre au sein du foyer : un même code ne doit jamais porter deux
  // rôles. Les collisions cross-foyer restent gardées par l'UNIQUE de colonne.
  let guestJoinCode = generateJoinCode();
  while (guestJoinCode === joinCode) guestJoinCode = generateJoinCode();
  const ua = request.headers.get("user-agent") ?? "";
  const deviceName = getDeviceName(ua);

  const supabase = createServerClient();

  // « Créer un foyer » est ADDITIF (Lot 4) : si l'appareil a déjà une session
  // résolvant vers un owner RÉEL (non démo), on crée le foyer et un membership
  // membre sur CET owner — pas de nouvelle session ni de cookie réécrit. Un
  // owner démo (monde gelé) déclenche au contraire une CONVERSION : il retombe
  // sur le chemin « owner neuf » ci-dessous (le membership démo est abandonné).
  const existingOwner = await resolveSessionOwnerFromCookie(request);

  if (existingOwner && !isDemoOwner(existingOwner)) {
    await attachNewHouseholdToOwner(supabase, {
      ownerId: existingOwner.ownerId,
      name,
      joinCode,
      guestJoinCode,
    });

    // Pas de cookie : la session courante est conservée. Redirection vers la
    // Home (et non le détail/édition du nouveau foyer) : créer un foyer depuis
    // le profil ramène à l'accueil ; le code d'invitation reste accessible sur
    // le détail du foyer.
    return NextResponse.json({ ok: true, redirect: "/home", added: true });
  }

  // Marqueur de conversion démo → carnet (dashboard v2, migration 032).
  const demoTrialStartedAt = await resolveDemoTrialStart(supabase, existingOwner);

  // Owner neuf + foyer neuf + membership membre + session (saga compensée,
  // cf. lib/db/onboarding.ts). L'id owner est généré côté app pour figer le
  // surnom (alias) dès l'insertion (031).
  const ownerId = crypto.randomUUID();
  const { sessionId: sid } = await provisionOwnerWithHousehold(supabase, {
    owner: {
      id: ownerId,
      alias: aliasForOwner(ownerId, await getLocale()),
      demoTrialStartedAt,
      // A/B onboarding (#25) : bras vu à la landing (cookie), null hors test.
      onboardingVariant: variantForNewOwner(request.cookies.get(AB_ONBOARDING_COOKIE)?.value),
    },
    household: {
      kind: "create",
      name,
      joinCode,
      guestJoinCode,
      origin: demoTrialStartedAt ? "demo_conversion" : "landing",
    },
    role: "member",
    deviceName,
  });

  const token = await signSession({ sid });

  // Cookie on a 200 JSON response (not a 303) — reliable in WKWebView.
  // Redirection Home simple : le hint « partage » de la Home (server-gated)
  // remplace l'ancienne bannière post-création (code d'invitation en clair).
  const response = NextResponse.json({ ok: true, redirect: "/home" });
  setSessionCookie(response, token);

  return response;
});
