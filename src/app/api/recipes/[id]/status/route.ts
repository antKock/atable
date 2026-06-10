import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { withHouseholdAuth } from "@/lib/api/with-household-auth";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withHouseholdAuth(
  async (_request: NextRequest, { params }: RouteContext, { householdId }) => {
    const { id } = await params;
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("recipes")
      .select("enrichment_status, image_status")
      .eq("id", id)
      .eq("household_id", householdId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    return NextResponse.json({
      enrichmentStatus: data.enrichment_status,
      imageStatus: data.image_status,
    });
  },
);
