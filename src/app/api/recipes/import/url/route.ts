import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { ImportUrlSchema } from "@/lib/schemas/import";
import { extractRecipeFromUrl } from "@/lib/import";

export async function POST(request: Request) {
  try {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = ImportUrlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "URL invalide" },
        { status: 400 },
      );
    }

    const formData = await extractRecipeFromUrl(parsed.data.url);
    return NextResponse.json(formData);
  } catch (error) {
    console.error("[import/url] Error:", error);
    const status = (error as { status?: number }).status;
    if (status === 429) {
      return NextResponse.json(
        { error: "Trop de requêtes, réessayez dans quelques instants" },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Impossible d'extraire la recette depuis cette URL" },
      { status: 422 },
    );
  }
}
