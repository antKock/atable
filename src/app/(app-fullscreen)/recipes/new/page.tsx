import { notFound } from "next/navigation";
import NewRecipeFlow from "@/components/recipes/NewRecipeFlow";
import { createServerClient } from "@/lib/supabase/server";
import {
  getOwnerContext,
  isGuestOwner,
  memberHouseholdIds,
} from "@/lib/auth/owner-context";
import type { MemberFoyer } from "@/components/recipes/RecipeForm";

// NewRecipeFlow reads search params (?import=url&url=… from the share sheet)
// via useSearchParams, which requires the route to render dynamically.
export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  // Garde serveur miroir du masquage UI (Lot 3/4) : un owner invité PARTOUT
  // (aucun rôle membre) qui atteint /recipes/new par URL directe est renvoyé en
  // 404 — l'API de création est déjà en 403, mais on n'affiche pas non plus le
  // formulaire.
  const owner = await getOwnerContext();
  if (!owner || isGuestOwner(owner)) notFound();

  // Foyers membres proposés au choix à l'enregistrement (multi-foyer, Lot 4),
  // avec leur compteur de recettes. En mono-foyer, RecipeForm poste sans dialog.
  const memberIds = memberHouseholdIds(owner);
  let memberFoyers: MemberFoyer[] = [];
  if (memberIds.length > 1) {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("households")
      .select("id, name, recipes(count)")
      .in("id", memberIds);
    const byId = new Map(
      (data ?? []).map((h) => [
        h.id,
        {
          name: h.name as string,
          // recipes(count) → [{ count }]
          recipeCount:
            (h.recipes as unknown as { count: number }[])?.[0]?.count ?? 0,
        },
      ]),
    );
    // Ordre des memberships (owner-context) : le hub fait foi.
    memberFoyers = memberIds
      .filter((id) => byId.has(id))
      .map((id) => ({ id, ...byId.get(id)! }));
  }

  return <NewRecipeFlow memberFoyers={memberFoyers} />;
}
