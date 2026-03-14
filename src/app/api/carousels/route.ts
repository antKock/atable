import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { fetchCarouselSections } from "@/lib/queries/carousels";

export async function GET() {
  try {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();
    const sections = await fetchCarouselSections(supabase, householdId);

    return NextResponse.json(sections);
  } catch {
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 },
    );
  }
}
