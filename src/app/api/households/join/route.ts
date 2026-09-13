import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/request-ip";
import { createServerClient } from "@/lib/supabase/server";
import { JoinCodeSchema } from "@/lib/schemas/household";
import { resolveInviteCode } from "@/lib/auth/invite-code";
import { joinRateLimit, joinCodeRateLimit } from "@/lib/redis";
import { getDeviceName } from "@/lib/auth/device-name";
import { signSession, setSessionCookie } from "@/lib/auth/session";
import { roleForHousehold, planRoleMerge } from "@/lib/auth/owner-context";
import { resolveSessionOwnerFromCookie } from "@/lib/auth/session-owner";
import { isDemoOwner } from "@/lib/api/with-owner-auth";
import { resolveDemoTrialStart } from "@/lib/queries/demo-conversion";
import { aliasForOwner } from "@/lib/alias";
import { getLocale } from "@/lib/i18n/server";
import { withPublicRoute } from "@/lib/api/with-public-route";
import { provisionOwnerWithHousehold } from "@/lib/db/onboarding";
import { isProbeHeaders } from "@/lib/probe";
import { insertMembership, updateMembershipRole } from "@/lib/db/households";
import { parseJsonBody } from "@/lib/api/body";

export const POST = withPublicRoute(async (request: NextRequest, _ctx, t) => {
  const result = await parseJsonBody(request, {
    t,
    schema: JoinCodeSchema,
    pick: (b) => (b as { code?: unknown } | null)?.code,
    unreadableMessage: (t) => t.api.codeInvalidFormat,
    invalidMessage: (t) => t.api.codeInvalidFormat,
  });
  if (result instanceof NextResponse) return result;

  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  const { success } = await joinRateLimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: t.join.rateLimited }, { status: 429 });
  }

  // Global per-code limit: stops a distributed brute-force that rotates IPs
  const { success: codeAllowed } = await joinCodeRateLimit.limit(result.data);
  if (!codeAllowed) {
    return NextResponse.json({ error: t.join.rateLimited }, { status: 429 });
  }

  const supabase = createServerClient();

  // Résout le code contre les DEUX liens stables du foyer (Lot 3) : join_code
  // → membre, guest_join_code → invité. Le rôle du membership en découle.
  const invite = await resolveInviteCode(supabase, result.data);

  if (!invite) {
    return NextResponse.json({ error: t.join.notFound }, { status: 404 });
  }

  const ua = hdrs.get("user-agent") ?? "";
  const deviceName = getDeviceName(ua);

  // Rejoindre est ADDITIF (Lot 4) : si l'appareil a déjà une session résolvant
  // vers un owner RÉEL (non démo), on ajoute un membership à CET owner — pas
  // de nouvelle session ni de réécriture de cookie. Un owner démo (monde gelé)
  // ne reçoit jamais de membership : il retombe sur le chemin « device neuf »
  // ci-dessous (= sortie de la démo, owner neuf).
  const existingOwner = await resolveSessionOwnerFromCookie(request);

  if (existingOwner && !isDemoOwner(existingOwner)) {
    const currentRole = roleForHousehold(existingOwner, invite.householdId);
    const plan = planRoleMerge(currentRole, invite.role);

    if (plan.action === "noop") {
      // Déjà membre, code ≤ rôle courant : jamais de rétrogradation.
      return NextResponse.json({ ok: true, redirect: "/household", alreadyMember: true });
    }
    if (plan.action === "upgrade") {
      await updateMembershipRole(supabase, {
        ownerId: existingOwner.ownerId,
        householdId: invite.householdId,
        role: plan.role,
      });
      return NextResponse.json({ ok: true, redirect: "/household", upgraded: true });
    }
    // action === 'add' : nouveau foyer pour cet owner.
    await insertMembership(supabase, {
      ownerId: existingOwner.ownerId,
      householdId: invite.householdId,
      role: plan.role,
    });
    return NextResponse.json({ ok: true, redirect: "/household", added: true });
  }

  // Device neuf (aucune session) OU sortie de démo : owner + membership + session.
  // Id généré côté app pour figer le surnom (alias) dès l'insertion (031).
  // Sortir de la démo en REJOIGNANT un carnet existant est une conversion au
  // même titre que la création (dashboard v2, 032).
  const demoTrialStartedAt = await resolveDemoTrialStart(supabase, existingOwner);

  const ownerId = crypto.randomUUID();
  const { sessionId } = await provisionOwnerWithHousehold(supabase, {
    owner: {
      id: ownerId,
      alias: aliasForOwner(ownerId, await getLocale()),
      demoTrialStartedAt,
      // Sonde (#26) : appareil d'Anthony ou agent qui rejoint un carnet, hors stats.
      isProbe: isProbeHeaders(request.headers),
    },
    household: { kind: "existing", householdId: invite.householdId },
    role: invite.role,
    deviceName,
  });

  const jwt = await signSession({ sid: sessionId });

  // Cookie on a 200 JSON response (not a 303) — reliable in WKWebView.
  const response = NextResponse.json({ ok: true, redirect: "/home" });
  setSessionCookie(response, jwt);

  return response;
});
