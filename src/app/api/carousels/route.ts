import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchCarouselSections } from "@/lib/queries/carousels";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { householdIds } from "@/lib/auth/owner-context";

export const GET = withOwnerAuth(async (_request, _ctx, owner) => {
  const ids = householdIds(owner);
  // Owner sans foyer (retrait de membre) : aucune section, pas de requête
  // dégénérée `in.()`.
  if (ids.length === 0) return NextResponse.json([]);

  const supabase = createServerClient();
  const sections = await fetchCarouselSections(supabase, ids);

  return NextResponse.json(sections);
});
