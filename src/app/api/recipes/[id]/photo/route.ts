import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

const PhotoUpdateSchema = z.object({
  photoUrl: z.string().url().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = PhotoUpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 422 }
      );
    }

    const supabase = createServerClient();

    // Verify the recipe exists and belongs to this household
    const { data: existing } = await supabase
      .from("recipes")
      .select("id")
      .eq("id", id)
      .eq("household_id", householdId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("recipes")
      .update({
        photo_url: result.data.photoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("household_id", householdId);

    if (error) throw error;

    revalidatePath("/");
    revalidatePath("/recipes/[id]", "page");

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
