import { NextResponse } from "next/server";
import { ImportScreenshotSchema } from "@/lib/schemas/import";
import { extractRecipeFromImages } from "@/lib/import";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ImportScreenshotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides" },
        { status: 400 },
      );
    }

    const formData = await extractRecipeFromImages(parsed.data.images);
    return NextResponse.json(formData);
  } catch (error) {
    console.error("[import/screenshot] Error:", error);
    const status = (error as { status?: number }).status;
    if (status === 429) {
      return NextResponse.json(
        { error: "Trop de requêtes, réessayez dans quelques instants" },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Impossible d'extraire la recette depuis les images" },
      { status: 422 },
    );
  }
}
