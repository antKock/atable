import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateShareToken } from "@/lib/auth/share-token";
import { withOwnerAuth, requireMember } from "@/lib/api/with-owner-auth";
import { householdIds } from "@/lib/auth/owner-context";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_ATTEMPTS = 5;

// POST /api/recipes/[id]/share
// Idempotently mints (or returns the existing) capability token for a recipe
// the caller's household owns, and returns the public share URL.
export const POST = withOwnerAuth(
  async (request: NextRequest, { params }: RouteContext, owner) => {
    const { id } = await params;
    const supabase = createServerClient();

    // La recette doit exister dans un foyer de l'owner ; le mint écrit
    // share_token → MEMBRE requis sur LE foyer de la recette (Lot 4).
    const { data: recipe, error } = await supabase
      .from("recipes")
      .select("id, share_token, household_id")
      .eq("id", id)
      .in("household_id", householdIds(owner))
      .single();

    if (error || !recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const forbidden = requireMember(owner, recipe.household_id);
    if (forbidden) return forbidden;
    const householdId = recipe.household_id;

    let token = recipe.share_token as string | null;

    if (!token) {
      // Mint a token, retrying on the (extremely unlikely) unique-index collision.
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const candidate = generateShareToken();
        const { data: updated, error: updateError } = await supabase
          .from("recipes")
          .update({ share_token: candidate })
          .eq("id", id)
          .eq("household_id", householdId)
          .is("share_token", null)
          .select("share_token")
          .maybeSingle();

        if (!updateError && updated?.share_token) {
          token = updated.share_token;
          break;
        }

        if (updateError && !updateError.message.includes("duplicate")) {
          throw updateError;
        }

        // Lost a race (token set concurrently) — re-read and use it.
        const { data: fresh } = await supabase
          .from("recipes")
          .select("share_token")
          .eq("id", id)
          .single();
        if (fresh?.share_token) {
          token = fresh.share_token;
          break;
        }
      }
    }

    if (!token) {
      throw new Error("Failed to mint share token");
    }

    const url = `${request.nextUrl.origin}/r/${token}`;
    return NextResponse.json({ token, url });
  },
);
