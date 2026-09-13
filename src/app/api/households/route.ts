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
    const { data: addHousehold, error: addHouseholdError } = await supabase
      .from("households")
      .insert({ name, join_code: joinCode, guest_join_code: guestJoinCode, origin: "additif" })
      .select("id")
      .single();
    if (addHouseholdError || !addHousehold) {
      throw new Error(addHouseholdError?.message ?? "Failed to create household");
    }

    const { error: addMembershipError } = await supabase
      .from("memberships")
      .insert({ owner_id: existingOwner.ownerId, household_id: addHousehold.id, role: "member" });
    if (addMembershipError) {
      await supabase.from("households").delete().eq("id", addHousehold.id);
      throw new Error(addMembershipError.message);
    }

    // Pas de cookie : la session courante est conservée. Redirection vers la
    // Home (et non le détail/édition du nouveau foyer) : créer un foyer depuis
    // le profil ramène à l'accueil ; le code d'invitation reste accessible sur
    // le détail du foyer.
    return NextResponse.json({ ok: true, redirect: "/home", added: true });
  }

  // Marqueur de conversion démo → carnet (dashboard v2, migration 032).
  const demoTrialStartedAt = await resolveDemoTrialStart(supabase, existingOwner);

  // Step 1: Insert owner — the abstract identity the household belongs to
  // (chantier foyer #14/#15); the device session below just points at it.
  // On génère l'id côté app pour figer le surnom (alias) dès l'insertion
  // (migration 031 : surnom statique, jamais re-dérivé).
  const ownerId = crypto.randomUUID();
  const { error: ownerError } = await supabase.from("owners").insert({
    id: ownerId,
    alias: aliasForOwner(ownerId, await getLocale()),
    demo_trial_started_at: demoTrialStartedAt,
    // A/B onboarding (#25) : bras vu à la landing (cookie), null hors test.
    onboarding_variant: variantForNewOwner(request.cookies.get(AB_ONBOARDING_COOKIE)?.value),
  });

  if (ownerError) {
    throw new Error(ownerError.message ?? "Failed to create owner");
  }

  // Step 2: Insert household
  const { data: household, error: householdError } = await supabase
    .from("households")
    .insert({
      name,
      join_code: joinCode,
      guest_join_code: guestJoinCode,
      origin: demoTrialStartedAt ? "demo_conversion" : "landing",
    })
    .select("id")
    .single();

  if (householdError || !household) {
    await supabase.from("owners").delete().eq("id", ownerId);
    throw new Error(householdError?.message ?? "Failed to create household");
  }
  const hid = household.id;

  // Step 3: Insert membership (member = lecture + écriture)
  const { error: membershipError } = await supabase
    .from("memberships")
    .insert({ owner_id: ownerId, household_id: hid, role: "member" });

  if (membershipError) {
    // Compensating deletes — owner delete cascades memberships/sessions
    await supabase.from("households").delete().eq("id", hid);
    await supabase.from("owners").delete().eq("id", ownerId);
    throw new Error(membershipError.message);
  }

  // Step 4: Insert device_session pointing at the owner
  const { data: session, error: sessionError } = await supabase
    .from("device_sessions")
    .insert({ household_id: hid, device_name: deviceName, owner_id: ownerId })
    .select("id")
    .single();

  if (sessionError || !session) {
    await supabase.from("households").delete().eq("id", hid);
    await supabase.from("owners").delete().eq("id", ownerId);
    throw new Error(sessionError?.message ?? "Failed to create session");
  }
  const sid = session.id;

  // Step 5: Migrate existing V1 recipes (household_id IS NULL) to this
  // household. No-op since migration 027 (household_id NOT NULL) — kept for
  // rollback, decommissioned at the end of the chantier foyer.
  const { error: migrateError } = await supabase
    .from("recipes")
    .update({ household_id: hid })
    .is("household_id", null);

  if (migrateError) {
    // Compensating deletes
    await supabase.from("households").delete().eq("id", hid);
    await supabase.from("owners").delete().eq("id", ownerId);
    throw new Error(migrateError.message);
  }

  const token = await signSession({ sid });

  // Cookie on a 200 JSON response (not a 303) — reliable in WKWebView.
  // Redirection Home simple : le hint « partage » de la Home (server-gated)
  // remplace l'ancienne bannière post-création (code d'invitation en clair).
  const response = NextResponse.json({ ok: true, redirect: "/home" });
  setSessionCookie(response, token);

  return response;
});
