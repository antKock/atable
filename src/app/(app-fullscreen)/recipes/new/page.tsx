import { notFound } from "next/navigation";
import NewRecipeFlow from "@/components/recipes/NewRecipeFlow";
import { getOwnerContext, isGuestOwner } from "@/lib/auth/owner-context";

// NewRecipeFlow reads search params (?import=url&url=… from the share sheet)
// via useSearchParams, which requires the route to render dynamically.
export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  // Garde serveur miroir du masquage UI (Lot 3) : un invité (lecture seule) qui
  // atteint /recipes/new par URL directe est renvoyé en 404 — l'API de création
  // est déjà en 403, mais on n'affiche pas non plus le formulaire.
  const owner = await getOwnerContext();
  if (owner && isGuestOwner(owner)) notFound();

  return <NewRecipeFlow />;
}
