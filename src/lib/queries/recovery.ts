import { createServerClient } from "@/lib/supabase/server";
import {
  generateMagicToken,
  generateRecoveryCode,
  sha256Hex,
  LOGIN_TOKEN_TTL_MS,
  LOGIN_CODE_MAX_ATTEMPTS,
} from "@/lib/auth/login-token";
import { mergePlan, type MergeOwner } from "@/lib/auth/merge-plan";

// Accès DB de la récupération d'accès + fusion (#14, Lot 2). Toutes les
// erreurs Supabase sont PROPAGÉES : les routes publiques les attrapent pour
// garder des réponses uniformes (anti-énumération), les routes withOwnerAuth
// laissent le wrapper faire le 500 générique.

export type LoginTokenPurpose = "recovery" | "merge";

/** Owner par email de secours (déjà normalisé lowercase). */
export async function findOwnerByEmail(email: string): Promise<{ id: string } | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("owners")
    .select("id")
    .eq("recovery_email", email)
    .maybeSingle();
  if (error) throw new Error(`recovery: lookup email impossible (${error.message})`);
  return data;
}

/**
 * Crée un login_token neuf pour l'owner et BRÛLE les précédents du même
 * purpose (un seul token actif : le code du dernier email fait foi — le
 * « Renvoyer » de l'UI invalide les emails précédents). Retourne les secrets
 * en clair pour l'email ; seuls les hashes touchent la DB.
 */
export async function createLoginToken(
  ownerId: string,
  purpose: LoginTokenPurpose,
): Promise<{ token: string; code: string }> {
  const supabase = createServerClient();
  const token = generateMagicToken();
  const code = generateRecoveryCode();
  const [tokenHash, codeHash] = await Promise.all([sha256Hex(token), sha256Hex(code)]);

  const { error: purgeError } = await supabase
    .from("login_tokens")
    .delete()
    .eq("owner_id", ownerId)
    .eq("purpose", purpose)
    .is("used_at", null);
  if (purgeError) throw new Error(`recovery: purge des tokens impossible (${purgeError.message})`);

  const { error } = await supabase.from("login_tokens").insert({
    owner_id: ownerId,
    purpose,
    token_hash: tokenHash,
    code_hash: codeHash,
    expires_at: new Date(Date.now() + LOGIN_TOKEN_TTL_MS).toISOString(),
  });
  if (error) throw new Error(`recovery: création du token impossible (${error.message})`);

  return { token, code };
}

export type ConsumedToken = { ownerId: string; purpose: LoginTokenPurpose };

/**
 * Consomme un magic-link : claim single-use ATOMIQUE (UPDATE conditionnel sur
 * used_at IS NULL — deux clics simultanés ne passent qu'une fois). Un token
 * expiré ou brûlé par 5 essais de code n'est plus consommable, lien compris.
 * `null` = invalide, sans distinction de cause (message générique côté UI).
 */
export async function consumeMagicToken(token: string): Promise<ConsumedToken | null> {
  const supabase = createServerClient();
  const tokenHash = await sha256Hex(token);
  const { data, error } = await supabase
    .from("login_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .lt("attempts", LOGIN_CODE_MAX_ATTEMPTS)
    .select("owner_id, purpose")
    .maybeSingle();
  if (error) throw new Error(`recovery: consommation du token impossible (${error.message})`);
  if (!data) return null;
  return { ownerId: data.owner_id, purpose: data.purpose as LoginTokenPurpose };
}

/**
 * Vérifie un code 6 chiffres contre le token actif de l'owner. Compteur
 * d'essais : au 5ᵉ raté le token est brûlé (attempts saturé — verify ET
 * consume le refusent ensuite). Succès = claim single-use, comme le lien.
 */
export async function verifyLoginCode(
  ownerId: string,
  purpose: LoginTokenPurpose,
  code: string,
): Promise<boolean> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("login_tokens")
    .select("id, code_hash, attempts")
    .eq("owner_id", ownerId)
    .eq("purpose", purpose)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`recovery: lecture du token impossible (${error.message})`);
  if (!row || row.attempts >= LOGIN_CODE_MAX_ATTEMPTS) return false;

  const codeHash = await sha256Hex(code);
  if (codeHash !== row.code_hash) {
    const { error: bumpError } = await supabase
      .from("login_tokens")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    if (bumpError) throw new Error(`recovery: incrément des essais impossible (${bumpError.message})`);
    return false;
  }

  const { data: claimed, error: claimError } = await supabase
    .from("login_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) throw new Error(`recovery: claim du token impossible (${claimError.message})`);
  return Boolean(claimed);
}

/**
 * Nouvelle device_session pour un owner récupéré (le « nouvel appareil »).
 * household_id (colonne legacy NOT NULL, vestigiale pour la résolution) =
 * premier foyer de l'owner. `null` si l'owner n'a plus aucun foyer — rien à
 * récupérer, l'appelant répond comme pour un email inconnu.
 */
export async function createOwnerSession(
  ownerId: string,
  deviceName: string,
): Promise<{ sessionId: string; householdId: string } | null> {
  const supabase = createServerClient();
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("household_id")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`recovery: lecture des memberships impossible (${error.message})`);
  if (!membership) return null;

  const { data: session, error: sessionError } = await supabase
    .from("device_sessions")
    .insert({
      household_id: membership.household_id,
      device_name: deviceName,
      owner_id: ownerId,
    })
    .select("id")
    .single();
  if (sessionError || !session) {
    throw new Error(`recovery: création de session impossible (${sessionError?.message})`);
  }
  return { sessionId: session.id, householdId: membership.household_id };
}

/**
 * Fusion d'owners (§5) : charge les deux identités, calcule le plan (fonction
 * pure mergePlan) et l'exécute en UNE transaction via la fonction SQL
 * merge_owners (migration 028). La source est supprimée ; ses sessions —
 * celle du device courant comprise — sont repointées vers la cible, donc le
 * cookie reste valide (le sid ne change pas).
 */
export async function executeMergeOwners(
  sourceOwnerId: string,
  targetOwnerId: string,
): Promise<void> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("owners")
    .select("id, name, memberships(household_id, role)")
    .in("id", [sourceOwnerId, targetOwnerId]);
  if (error) throw new Error(`merge: lecture des owners impossible (${error.message})`);

  const byId = new Map(
    (data ?? []).map((row) => [
      row.id as string,
      {
        name: (row.name as string | null) ?? null,
        memberships: ((row.memberships ?? []) as { household_id: string; role: string }[]).map(
          (m) => ({
            householdId: m.household_id,
            role: m.role === "guest" ? ("guest" as const) : ("member" as const),
          }),
        ),
      } satisfies MergeOwner,
    ]),
  );
  const source = byId.get(sourceOwnerId);
  const target = byId.get(targetOwnerId);
  if (!source || !target) throw new Error("merge: owner source ou cible introuvable");

  const plan = mergePlan(source, target);
  const { error: rpcError } = await supabase.rpc("merge_owners", {
    p_source_id: sourceOwnerId,
    p_target_id: targetOwnerId,
    p_name: plan.name,
    p_adopt_household_ids: plan.adoptHouseholdIds,
    p_upgrade_household_ids: plan.upgradeHouseholdIds,
  });
  if (rpcError) throw new Error(`merge: exécution merge_owners impossible (${rpcError.message})`);
}
