import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { householdIds } from "@/lib/auth/owner-context";
import { getT } from "@/lib/i18n/server";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withOwnerAuth(
  async (_request: NextRequest, { params }: RouteContext, owner) => {
    const t = await getT();
    const { id } = await params;
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("recipes")
      .select("enrichment_status, image_status")
      .eq("id", id)
      .in("household_id", householdIds(owner))
      .single();

    if (error || !data) {
      return NextResponse.json({ error: t.api.recipeNotFound }, { status: 404 });
    }

    return NextResponse.json({
      enrichmentStatus: data.enrichment_status,
      imageStatus: data.image_status,
    });
  },
);
