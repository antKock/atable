import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { loadOwnedRecipe } from "@/lib/db/recipes";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withOwnerAuth(
  async (_request: NextRequest, { params }: RouteContext, owner) => {
    const { id } = await params;
    const loaded = await loadOwnedRecipe(createServerClient(), id, owner, {
      columns: ["enrichment_status", "image_status"],
    });
    if (loaded instanceof NextResponse) return loaded;

    return NextResponse.json({
      enrichmentStatus: loaded.recipe.enrichment_status,
      imageStatus: loaded.recipe.image_status,
    });
  },
);
