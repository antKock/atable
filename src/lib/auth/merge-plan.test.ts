import { describe, it, expect } from "vitest";
import { mergePlan, type MergeOwner } from "./merge-plan";

// La cible = l'owner qui portait déjà l'email ; la source = la session
// courante. Contrat spec §5 : union des foyers, rôle le plus fort
// (member > guest), nom de la cible sinon de la source.

const H1 = "11111111-1111-1111-1111-111111111111";
const H2 = "22222222-2222-2222-2222-222222222222";
const H3 = "33333333-3333-3333-3333-333333333333";

function owner(name: string | null, memberships: MergeOwner["memberships"]): MergeOwner {
  return { name, memberships };
}

describe("mergePlan — union des memberships", () => {
  it("adopte les foyers de la source absents de la cible", () => {
    const plan = mergePlan(
      owner(null, [{ householdId: H1, role: "member" }, { householdId: H2, role: "guest" }]),
      owner(null, [{ householdId: H3, role: "member" }]),
    );
    expect(plan.adoptHouseholdIds).toEqual([H1, H2]);
    expect(plan.upgradeHouseholdIds).toEqual([]);
  });

  it("foyer commun : source member + cible guest → upgrade (rôle le plus fort)", () => {
    const plan = mergePlan(
      owner(null, [{ householdId: H1, role: "member" }]),
      owner(null, [{ householdId: H1, role: "guest" }]),
    );
    expect(plan.adoptHouseholdIds).toEqual([]);
    expect(plan.upgradeHouseholdIds).toEqual([H1]);
  });

  it("foyer commun : jamais de rétrogradation (cible member, source guest)", () => {
    const plan = mergePlan(
      owner(null, [{ householdId: H1, role: "guest" }]),
      owner(null, [{ householdId: H1, role: "member" }]),
    );
    expect(plan.adoptHouseholdIds).toEqual([]);
    expect(plan.upgradeHouseholdIds).toEqual([]);
  });

  it("foyer commun au même rôle → aucun changement", () => {
    const both = [{ householdId: H1, role: "member" as const }];
    const plan = mergePlan(owner(null, both), owner(null, both));
    expect(plan.adoptHouseholdIds).toEqual([]);
    expect(plan.upgradeHouseholdIds).toEqual([]);
  });

  it("doublon dans l'entrée source → une seule adoption", () => {
    const plan = mergePlan(
      owner(null, [
        { householdId: H1, role: "member" },
        { householdId: H1, role: "member" },
      ]),
      owner(null, []),
    );
    expect(plan.adoptHouseholdIds).toEqual([H1]);
  });
});

describe("mergePlan — nom", () => {
  it("garde le nom de la cible quand elle en a un", () => {
    const plan = mergePlan(owner("Source", []), owner("Cible", []));
    expect(plan.name).toBe("Cible");
  });

  it("reprend celui de la source quand la cible n'en a pas", () => {
    const plan = mergePlan(owner("Source", []), owner(null, []));
    expect(plan.name).toBe("Source");
  });

  it("null quand aucun des deux n'est nommé (→ alias auto à l'affichage)", () => {
    const plan = mergePlan(owner(null, []), owner(null, []));
    expect(plan.name).toBeNull();
  });
});
