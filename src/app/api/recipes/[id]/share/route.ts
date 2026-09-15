import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { loadOwnedRecipe } from "@/lib/db/recipes";
import { ensureShareToken } from "@/lib/db/share-token";
import { getLocale } from "@/lib/i18n/server";
import { getRequestOrigin } from "@/lib/request-origin";
import { buildShareUrl } from "@/lib/share-url";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/recipes/[id]/share
// Idempotently mints (or returns the existing) capability token for a recipe
// the caller's household owns, and returns the public share URL.
export const POST = withOwnerAuth(
  async (request: NextRequest, { params }: RouteContext, owner) => {
    const { id } = await params;
    const supabase = createServerClient();

    // Partager n'expose qu'une lecture publique (lien capability) d'une recette
    // que l'owner peut DÉJÀ voir : autorisé pour un MEMBRE comme pour un INVITÉ
    // du foyer (décision produit — seul le partage échappe à la lecture seule de
    // l'invité ; éditer/supprimer/déplacer restent membres). L'accès est borné
    // par householdIds(owner) ci-dessous ; le mint de share_token est une
    // écriture bénigne (jeton aléatoire, contenu de la recette inchangé).
    const loaded = await loadOwnedRecipe(supabase, id, owner, { columns: ["share_token"] });
    if (loaded instanceof NextResponse) return loaded;
    const { recipe } = loaded;

    const householdId = recipe.household_id;

    const token = await ensureShareToken(supabase, id, householdId, recipe.share_token);

    // La langue de l'appareil émetteur voyage dans l'URL (`?l=en`, hors fr)
    // pour que l'aperçu du lien sorte dans sa langue — cf. share-url.ts.
    const url = buildShareUrl(getRequestOrigin(request), token, await getLocale());
    return NextResponse.json({ token, url });
  },
  // Un visiteur démo peut partager (lecture publique d'une recette qu'il voit
  // déjà) : c'est un canal d'acquisition, et le mint du jeton est idempotent.
  // La garde démo par défaut de withOwnerAuth est donc levée ici.
  { allowDemoMutation: true },
);
