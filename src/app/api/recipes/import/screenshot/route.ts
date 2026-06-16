import { NextResponse } from "next/server";
import { ImportScreenshotSchema } from "@/lib/schemas/import";
import { extractRecipeFromImages } from "@/lib/import";
import { t } from "@/lib/i18n/fr";
import { enforceImportQuota } from "@/lib/import-quota";
import { withHouseholdAuth } from "@/lib/api/with-household-auth";

export const POST = withHouseholdAuth(async (request: Request, _ctx, { householdId }) => {
  const quotaResponse = await enforceImportQuota(householdId);
  if (quotaResponse) return quotaResponse;

  try {
    const body = await request.json();
    const parsed = ImportScreenshotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides" },
        { status: 400 },
      );
    }

    const formData = await extractRecipeFromImages(parsed.data.images, { householdId });
    return NextResponse.json(formData);
  } catch (error) {
    console.error("[import/screenshot] Error:", error);
    const status = (error as { status?: number }).status;
    if (status === 429) {
      return NextResponse.json(
        { error: t.import.errorRateLimit },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Impossible d'extraire la recette depuis les images" },
      { status: 422 },
    );
  }
});
