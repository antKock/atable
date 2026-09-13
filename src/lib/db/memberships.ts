import type { DbClient } from "@/lib/supabase/server";

/** Nombre de memberships `member` du foyer — garde « dernier membre ». */
export async function countMembers(db: DbClient, householdId: string): Promise<number> {
  const { count, error } = await db
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("role", "member");
  if (error) throw new Error(error.message);
  return count ?? 0;
}
