import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { withHouseholdAuth } from "@/lib/api/with-household-auth";

export const GET = withHouseholdAuth(async (_request, _ctx, { householdId }) => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, category")
    .or(`household_id.is.null,household_id.eq.${householdId}`)
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) throw error;

  return NextResponse.json({ tags: data ?? [] });
});

const CreateTagSchema = z.object({
  name: z.string().min(1).max(50),
});

export const POST = withHouseholdAuth(async (request: NextRequest, _ctx, { householdId }) => {
  const body = await request.json();
  const result = CreateTagSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 422 }
    );
  }

  const supabase = createServerClient();

  // Check if tag with same name already exists (predefined or household-scoped)
  const { data: existing } = await supabase
    .from("tags")
    .select("id, name, category")
    .or(`household_id.is.null,household_id.eq.${householdId}`)
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
}, { requireMember: true });
