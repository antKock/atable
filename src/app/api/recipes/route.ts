import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { RecipeCreateSchema } from "@/lib/schemas/recipe";
import { mapDbRowToRecipe } from "@/lib/supabase/mappers";
import type { RecipeListItem } from "@/types/recipe";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("recipes")
      .select("id, title, ingredients, tags, photo_url, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const recipes: RecipeListItem[] = (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      ingredients: row.ingredients,
      tags: row.tags ?? [],
      photoUrl: row.photo_url,
      createdAt: row.created_at,
    }));

    return NextResponse.json(recipes);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = RecipeCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 422 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("recipes")
      .insert({
        title: result.data.title,
        ingredients: result.data.ingredients ?? null,
        steps: result.data.steps ?? null,
        tags: result.data.tags ?? [],
        photo_url: result.data.photoUrl ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/");
    revalidatePath("/recipes/[id]");

    return NextResponse.json(mapDbRowToRecipe(data), { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
