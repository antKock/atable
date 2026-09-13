import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getDeviceName } from "@/lib/auth/device-name";
import { signSession, setSessionCookie } from "@/lib/auth/session";
import { aliasForOwner } from "@/lib/alias";
import { getLocale } from "@/lib/i18n/server";
import { withPublicRoute } from "@/lib/api/with-public-route";
import { getClientIp } from "@/lib/request-ip";
import { enforceDemoSessionQuota } from "@/lib/import-quota";

export const POST = withPublicRoute(async (request: NextRequest) => {
  // Chaque session démo crée un owner : plafond par IP (5/h, comme la
  // création de carnet).
  const quotaResponse = await enforceDemoSessionQuota(getClientIp(request));
  if (quotaResponse) return quotaResponse;

  // Version EN (Lot 3) : un appareil anglais atterrit sur le foyer démo EN
  // s'il est configuré, sinon sur le FR (dégradé mais jamais vide).
  const locale = await getLocale();
  const demoHouseholdId =
    (locale === "en" && process.env.DEMO_HOUSEHOLD_ID_EN) || process.env.DEMO_HOUSEHOLD_ID;
  if (!demoHouseholdId) {
    return NextResponse.json({ error: "Demo not configured" }, { status: 503 });
  }

  const ua = request.headers.get("user-agent") ?? "";
  const deviceName = getDeviceName(ua);

  const supabase = createServerClient();

  // Stratégie C (monde gelé) : un visiteur démo a un owner + membership
  // normaux — c'est la surface foyer/membership/profil qui est coupée (garde
  // démo par défaut de withOwnerAuth). Purge des owners démo par le cron demo-reset.
  const ownerId = crypto.randomUUID();
  const { error: ownerError } = await supabase
    .from("owners")
    .insert({ id: ownerId, alias: aliasForOwner(ownerId, locale) });

  if (ownerError) {
    throw new Error(ownerError.message ?? "Failed to create demo owner");
  }

  const { error: membershipError } = await supabase
    .from("memberships")
    .insert({ owner_id: ownerId, household_id: demoHouseholdId, role: "member" });

  if (membershipError) {
    await supabase.from("owners").delete().eq("id", ownerId);
    throw new Error(membershipError.message);
  }

  const { data: session, error } = await supabase
    .from("device_sessions")
    .insert({ household_id: demoHouseholdId, device_name: deviceName, owner_id: ownerId })
    .select("id")
    .single();

  if (error || !session) {
    // Owner delete cascades the membership
    await supabase.from("owners").delete().eq("id", ownerId);
    throw new Error(error?.message ?? "Failed to create demo session");
  }

  const token = await signSession({ sid: session.id });

  // Set the session cookie on a 200 JSON response instead of a 303 redirect:
  // cookies attached to redirects are unreliable in WKWebView. The client
  // reads `redirect` from the body and navigates itself.
  const response = NextResponse.json({ ok: true, redirect: "/home" });
  setSessionCookie(response, token);

  return response;
});
