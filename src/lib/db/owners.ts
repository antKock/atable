import type { DbClient } from "@/lib/supabase/server";
import type { OnboardingVariant } from "@/lib/ab-onboarding";

/** Crée une identité (owner). L'id est généré côté app pour figer l'alias (031). */
export async function insertOwner(
  db: DbClient,
  owner: {
    id: string;
    alias: string;
    demoTrialStartedAt?: string | null;
    /** A/B onboarding (#25) : bras vu à la landing, null hors test. */
    onboardingVariant?: OnboardingVariant | null;
  },
): Promise<void> {
  const { error } = await db.from("owners").insert({
    id: owner.id,
    alias: owner.alias,
    ...(owner.demoTrialStartedAt !== undefined
      ? { demo_trial_started_at: owner.demoTrialStartedAt }
      : {}),
    ...(owner.onboardingVariant !== undefined
      ? { onboarding_variant: owner.onboardingVariant }
      : {}),
  });
  if (error) throw new Error(error.message ?? "Failed to create owner");
}

/**
 * Supprime un owner. Depuis la 027, la suppression CASCADE ses memberships et
 * ses device_sessions : c'est la compensation naturelle d'une saga
 * d'onboarding qui a créé l'owner (cf. onboarding.ts).
 */
export async function deleteOwner(db: DbClient, ownerId: string): Promise<void> {
  await db.from("owners").delete().eq("id", ownerId);
}
