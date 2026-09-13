import type { DbClient } from "@/lib/supabase/server";
import type { MembershipRole } from "@/lib/auth/owner-context";
import { deleteOwner, insertOwner } from "@/lib/db/owners";
import {
  deleteHousehold,
  insertHousehold,
  insertMembership,
  type HouseholdOrigin,
} from "@/lib/db/households";
import { insertDeviceSession } from "@/lib/db/sessions";

// Sagas d'onboarding (revue 2026-09-12, lot 5) — les trois chemins
// d'acquisition (créer un carnet, rejoindre, essayer la démo) créaient chacun
// « owner + membership + session » avec des compensations divergentes.
//
// SÉMANTIQUE DES COMPENSATIONS (une seule, écrite ici avant d'unifier) :
//   Pas de transaction côté PostgREST → saga à étapes compensées. Sur échec
//   d'une étape, on supprime ce que LA SAGA a créé, dans l'ordre inverse :
//     1. le foyer, seulement s'il vient d'être créé par cette saga (jamais un
//        foyer préexistant — rejoindre / démo) ; sa suppression CASCADE
//        recettes, memberships et sessions (027) ;
//     2. l'owner, dont la suppression CASCADE memberships et device_sessions.
//   Les compensations sont best-effort (une erreur de compensation ne masque
//   pas l'erreur d'origine, qui est relancée telle quelle). L'ancienne étape
//   « migrer les recettes V1 sans foyer » (no-op depuis la 027) est supprimée.

export type ProvisionTarget =
  | {
      kind: "create";
      name: string;
      joinCode: string;
      guestJoinCode: string;
      origin: HouseholdOrigin;
    }
  | { kind: "existing"; householdId: string };

export type ProvisionInput = {
  owner: { id: string; alias: string; demoTrialStartedAt?: string | null };
  household: ProvisionTarget;
  role: MembershipRole;
  deviceName: string;
};

export type ProvisionResult = { ownerId: string; householdId: string; sessionId: string };

/**
 * Owner NEUF + (foyer neuf ou existant) + membership + session d'appareil.
 * Chemins : créer un carnet depuis la landing / sortie de démo (foyer neuf),
 * rejoindre depuis un appareil neuf (foyer existant), session démo (foyer
 * démo existant, rôle membre).
 */
export async function provisionOwnerWithHousehold(
  db: DbClient,
  input: ProvisionInput,
): Promise<ProvisionResult> {
  const ownerId = input.owner.id;
  await insertOwner(db, input.owner);

  let householdId: string;
  let createdHousehold = false;
  const compensate = async () => {
    if (createdHousehold) await deleteHousehold(db, householdId).catch(() => {});
    await deleteOwner(db, ownerId).catch(() => {});
  };

  try {
    if (input.household.kind === "create") {
      householdId = await insertHousehold(db, input.household);
      createdHousehold = true;
    } else {
      householdId = input.household.householdId;
    }
    await insertMembership(db, { ownerId, householdId, role: input.role });
    const sessionId = await insertDeviceSession(db, {
      ownerId,
      householdId,
      deviceName: input.deviceName,
    });
    return { ownerId, householdId, sessionId };
  } catch (err) {
    await compensate();
    throw err;
  }
}

/**
 * Owner EXISTANT (session réelle) + foyer NEUF + membership membre — « Créer
 * un carnet » additif depuis le hub. Pas de session ni de cookie : l'appareil
 * garde sa session. Compensation : le foyer neuf seulement (l'owner préexiste).
 */
export async function attachNewHouseholdToOwner(
  db: DbClient,
  input: { ownerId: string; name: string; joinCode: string; guestJoinCode: string },
): Promise<{ householdId: string }> {
  const householdId = await insertHousehold(db, { ...input, origin: "additif" });
  try {
    await insertMembership(db, { ownerId: input.ownerId, householdId, role: "member" });
  } catch (err) {
    await deleteHousehold(db, householdId).catch(() => {});
    throw err;
  }
  return { householdId };
}
