import type { DbClient } from "@/lib/supabase/server";
import type { MembershipRole } from "@/lib/auth/owner-context";

export type HouseholdOrigin = "landing" | "demo_conversion" | "additif";

/** Crée un foyer avec ses deux codes stables (membre / invité). Renvoie son id. */
export async function insertHousehold(
  db: DbClient,
  household: {
    name: string;
    joinCode: string;
    guestJoinCode: string;
    origin: HouseholdOrigin;
    /** Sonde (#26) : foyer créé par un appareil d'Anthony ou un agent, hors stats. */
    isProbe?: boolean;
  },
): Promise<string> {
  const { data, error } = await db
    .from("households")
    .insert({
      name: household.name,
      join_code: household.joinCode,
      guest_join_code: household.guestJoinCode,
      origin: household.origin,
      ...(household.isProbe ? { is_probe: true } : {}),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create household");
  return data.id;
}

/**
 * Supprime un foyer (CASCADE recettes, memberships, device_sessions — 027).
 * Réservé à la compensation d'un foyer que la saga vient de créer : jamais sur
 * un foyer préexistant (rejoindre, démo).
 */
export async function deleteHousehold(db: DbClient, householdId: string): Promise<void> {
  await db.from("households").delete().eq("id", householdId);
}

/** Ajoute un membership (rôle membre ou invité) à un owner sur un foyer. */
export async function insertMembership(
  db: DbClient,
  m: { ownerId: string; householdId: string; role: MembershipRole },
): Promise<void> {
  const { error } = await db
    .from("memberships")
    .insert({ owner_id: m.ownerId, household_id: m.householdId, role: m.role });
  if (error) throw new Error(error.message ?? "Failed to create membership");
}

/** Change le rôle d'un membership existant (re-join avec un code plus fort). */
export async function updateMembershipRole(
  db: DbClient,
  m: { ownerId: string; householdId: string; role: MembershipRole },
): Promise<void> {
  const { error } = await db
    .from("memberships")
    .update({ role: m.role })
    .eq("owner_id", m.ownerId)
    .eq("household_id", m.householdId);
  if (error) throw new Error(error.message ?? "Failed to update membership");
}
