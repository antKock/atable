import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { withOwnerAuth, resolveWriteHousehold } from "@/lib/api/with-owner-auth";
import { householdIds, memberHouseholdIds } from "@/lib/auth/owner-context";

export const GET = withOwnerAuth(async (_request, _ctx, owner) => {
  const supabase = createServerClient();
  // Tags globaux (household_id NULL) + tags custom de l'un des foyers de l'owner.
  const ids = householdIds(owner);
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, category")
    .or(`household_id.is.null,household_id.in.(${ids.join(",")})`)
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) throw error;

  return NextResponse.json({ tags: data ?? [] });
});

const CreateTagSchema = z.object({
  name: z.string().min(1).max(50),
});

export const POST = withOwnerAuth(async (request: NextRequest, _ctx, owner) => {
  const body = await request.json();
  const result = CreateTagSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 422 }
    );
  }

  // Un tag custom se crée dans un foyer où l'owner est MEMBRE. Le tag est saisi
  // dans le formulaire avant le choix du foyer de destination : on le rattache
  // au premier foyer membre (le tag reste résolu à l'affichage via recipe_tags,
  // quel que soit le foyer de la recette).
  const target = resolveWriteHousehold(owner, undefined);
  const householdId =
    target instanceof NextResponse ? memberHouseholdIds(owner)[0] : target.householdId;
  if (!householdId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServerClient();
  const ids = householdIds(owner);

  // Check if tag with same name already exists (predefined or scoped to one of
  // the owner's households)
  const { data: existing } = await supabase
    .from("tags")
    .select("id, name, category")
    .or(`household_id.is.null,household_id.in.(${ids.join(",")})`)
    .ilike("name", result.data.name)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json(existing);
  }

  // Create custom tag
  const { data, error } = await supabase
    .from("tags")
    .insert({
      name: result.data.name,
      is_predefined: false,
      household_id: householdId,
      category: null,
    })
    .select("id, name, category")
    .single();

  if (error) throw error;

  return NextResponse.json(data, { status: 201 });
});
