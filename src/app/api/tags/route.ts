import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("tags")
      .select("id, name, category")
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .order("category", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ tags: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

const CreateTagSchema = z.object({
  name: z.string().min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
