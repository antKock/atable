import type { MembershipRole } from "./owner-context";

// Fusion d'owners (#14, §5) : décisions pures, séparées de l'exécution.
// L'exécution atomique vit dans la fonction SQL merge_owners (migration 028) ;
// elle reçoit ce plan tel quel. La CIBLE = l'owner qui portait déjà
// recovery_email ; la source = l'owner de la session courante, supprimé en fin
// de fusion (ses memberships en doublon partent par cascade).

export type MergeMembership = {
  householdId: string;
  role: MembershipRole;
};

export type MergeOwner = {
  name: string | null;
  memberships: MergeMembership[];
};

export type MergePlan = {
  // Nom final de la cible : elle garde le sien, sinon celui de la source.
  name: string | null;
  // Memberships source à repointer vers la cible (foyers absents chez elle).
  adoptHouseholdIds: string[];
  // Memberships cible à passer 'member' (rôle le plus fort : member > guest).
  upgradeHouseholdIds: string[];
};

export function mergePlan(source: MergeOwner, target: MergeOwner): MergePlan {
  const targetRoles = new Map(
    target.memberships.map((m) => [m.householdId, m.role]),
  );

  const adoptHouseholdIds: string[] = [];
  const upgradeHouseholdIds: string[] = [];
  const seen = new Set<string>();

  for (const membership of source.memberships) {
    // Dédup défensive : UNIQUE(owner_id, household_id) en DB, mais un doublon
    // dans l'entrée ne doit pas produire deux adoptions du même foyer.
    if (seen.has(membership.householdId)) continue;
    seen.add(membership.householdId);

    const targetRole = targetRoles.get(membership.householdId);
    if (targetRole === undefined) {
      adoptHouseholdIds.push(membership.householdId);
    } else if (targetRole === "guest" && membership.role === "member") {
      upgradeHouseholdIds.push(membership.householdId);
    }
    // target member / source guest → rien : jamais de rétrogradation.
  }

  return {
    name: target.name ?? source.name ?? null,
    adoptHouseholdIds,
    upgradeHouseholdIds,
  };
}
