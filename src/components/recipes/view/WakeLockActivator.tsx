"use client";

import { useWakeLock } from "@/hooks/useWakeLock";
import { track } from "@/lib/events/client";

/**
 * Écran allumé pendant la lecture d'une recette. Le wake lock obtenu est le
 * signal « on cuisine avec l'app » : émis une fois par montage (#28,
 * `recipe.cooking_started`) — pas à chaque ré-acquisition au retour au premier
 * plan, ce serait compter la même cuisson plusieurs fois.
 */
export default function WakeLockActivator({ recipeId }: { recipeId: string }) {
  useWakeLock({ onAcquired: () => track("recipe.cooking_started", { recipe_id: recipeId }) });
  return null;
}
