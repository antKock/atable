import { NextResponse } from "next/server";
import { forbiddenResponse } from "@/lib/api/with-owner-auth";
import { memberHouseholdIds, type OwnerContext } from "@/lib/auth/owner-context";
import type { FullDictionary } from "@/lib/i18n/types";

/**
 * Foyer auquel rattacher un import IA (url / capture / voix). L'import
 * précède le choix du foyer de destination (dialog à l'enregistrement) : le
 * quota et l'attribution du coût IA vont au PREMIER foyer où l'owner est
 * MEMBRE (biais assumé, cf. revue 2026-09-12). Un invité — lecture seule —
 * est refusé (403). Préambule commun aux trois routes d'import.
 */
export function resolveImportHousehold(
  owner: OwnerContext,
  t: FullDictionary,
): { householdId: string } | NextResponse {
  const memberIds = memberHouseholdIds(owner);
  if (memberIds.length === 0) return forbiddenResponse(t);
  return { householdId: memberIds[0] };
}
