import type { DbClient } from "@/lib/supabase/server";

/**
 * Crée la session d'un appareil, pointée sur un owner. `household_id` est une
 * colonne vestigiale (NOT NULL, FK CASCADE) : on y met le foyer de la saga
 * pour garder la session vivante, rien ne scope dessus.
 */
export async function insertDeviceSession(
  db: DbClient,
  s: { ownerId: string; householdId: string; deviceName: string },
): Promise<string> {
  const { data, error } = await db
    .from("device_sessions")
    .insert({ owner_id: s.ownerId, household_id: s.householdId, device_name: s.deviceName })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create session");
  return data.id;
}
