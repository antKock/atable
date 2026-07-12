import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { fetchCarouselSections } from "@/lib/queries/carousels";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { householdIds } from "@/lib/auth/owner-context";
import { HOME_HIDDEN_FOYERS_COOKIE, parseHiddenFoyers } from "@/lib/home-foyers";

export const GET = withOwnerAuth(async (_request, _ctx, owner) => {
  const allIds = householdIds(owner);
  // Owner sans foyer (retrait de membre) : aucune section, pas de requête
  // dégénérée `in.()`.
  if (allIds.length === 0) return NextResponse.json([]);

  // Réglage multi-foyer « affichés sur l'accueil » : on écarte les foyers
  // masqués. Garde-fou : si le filtre ne laisse rien (cookie périmé, foyer
  // quitté…), on retombe sur tous les foyers plutôt qu'un accueil vide.
  const cookieStore = await cookies();
  const hidden = parseHiddenFoyers(cookieStore.get(HOME_HIDDEN_FOYERS_COOKIE)?.value);
  const shown = allIds.filter((id) => !hidden.includes(id));
  const ids = shown.length > 0 ? shown : allIds;

  const supabase = createServerClient();
  const sections = await fetchCarouselSections(supabase, ids);

  return NextResponse.json(sections);
});
