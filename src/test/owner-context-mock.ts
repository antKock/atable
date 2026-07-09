import { headers } from "next/headers";
import type { OwnerContext } from "@/lib/auth/owner-context";

/**
 * Implémentation de test de getOwnerContext, pilotée par les mêmes headers
 * mockés (`next/headers`) que l'ancien guard : les tests de routes continuent
 * de simuler l'auth via `x-household-id` / `x-session-id` sans queue Supabase
 * supplémentaire (la vraie résolution DB est couverte par owner-context.test.ts).
 * Headers absents → null (déconnecté), comme une session inconnue en DB.
 *
 * Usage en tête de fichier de test :
 *   vi.mock("@/lib/auth/owner-context", async () => {
 *     const { ownerContextFromTestHeaders } = await import("@/test/owner-context-mock");
 *     return { getOwnerContext: vi.fn(ownerContextFromTestHeaders) };
 *   });
 */
export async function ownerContextFromTestHeaders(): Promise<OwnerContext | null> {
  const hdrs = await headers();
  const householdId = hdrs.get("x-household-id");
  if (!householdId) return null;
  return {
    ownerId: "owner-test",
    sessionId: hdrs.get("x-session-id") ?? "session-test",
    memberships: [{ householdId, role: "member", isDemo: false }],
  };
}
