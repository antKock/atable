import { memberHouseholdIds, type OwnerContext } from "@/lib/auth/owner-context";

// Admin gating for the usage dashboard. Access is restricted to the household
// IDs listed in ADMIN_HOUSEHOLD_IDS (comma-separated env var) — the dashboard
// is for the founder only. With the var unset, nobody is admin (fail closed).

function adminHouseholdIds(): string[] {
  return (process.env.ADMIN_HOUSEHOLD_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Multi-foyer (Lot 4) : l'admin se déduit des foyers de l'owner (le
// x-household-id a disparu). Vrai si l'UN d'eux est listé dans
// ADMIN_HOUSEHOLD_IDS. Prend des IDs bruts : l'appelant est responsable de ne
// passer QUE des foyers où l'owner est MEMBRE (cf. isAdminOwner).
export function isAdminForHouseholds(ids: string[]): boolean {
  const admin = adminHouseholdIds();
  return ids.some((id) => admin.includes(id));
}

// Revue 2026-09 : un INVITÉ (rôle guest, lecture seule) d'un foyer admin ne
// doit pas hériter du dashboard — un lien d'invitation partagé suffirait à
// l'ouvrir. Seules les memberships `member` comptent.
export function isAdminOwner(owner: OwnerContext): boolean {
  return isAdminForHouseholds(memberHouseholdIds(owner));
}
