import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchCarouselSections } from "@/lib/queries/carousels";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { householdIds } from "@/lib/auth/owner-context";

export const GET = withOwnerAuth(async (_request, _ctx, owner) => {
  const supabase = createServerClient();
  const sections = await fetchCarouselSections(supabase, householdIds(owner));

  return NextResponse.json(sections);
});
