import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchCarouselSections } from "@/lib/queries/carousels";
import { withHouseholdAuth } from "@/lib/api/with-household-auth";

export const GET = withHouseholdAuth(async (_request, _ctx, { householdId }) => {
  const supabase = createServerClient();
  const sections = await fetchCarouselSections(supabase, householdId);

  return NextResponse.json(sections);
});
