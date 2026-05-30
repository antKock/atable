// Admin gating for the usage dashboard. Access is restricted to the household
// IDs listed in ADMIN_HOUSEHOLD_IDS (comma-separated env var) — the dashboard
// is for the founder only. With the var unset, nobody is admin (fail closed).

function adminHouseholdIds(): string[] {
  return (process.env.ADMIN_HOUSEHOLD_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdmin(householdId: string | null | undefined): boolean {
  if (!householdId) return false;
  return adminHouseholdIds().includes(householdId);
}
