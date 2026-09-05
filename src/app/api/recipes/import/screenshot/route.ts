import { NextResponse } from "next/server";
import { buildImportScreenshotSchema } from "@/lib/schemas/import";
import { extractRecipeFromImages } from "@/lib/import";
import { getT } from "@/lib/i18n/server";
import { enforceImportQuota } from "@/lib/import-quota";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { memberHouseholdIds } from "@/lib/auth/owner-context";

export const POST = withOwnerAuth(async (request: Request, _ctx, owner) => {
  const t = await getT();
  // Quota/coût IA rattachés au premier foyer membre (l'import précède le choix
  // du foyer). Invité (lecture seule) refusé.
  const memberIds = memberHouseholdIds(owner);
  if (memberIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const householdId = memberIds[0];

  const quotaResponse = await enforceImportQuota(householdId);
  if (quotaResponse) return quotaResponse;

  try {
    const body = await request.json();
    const parsed = buildImportScreenshotSchema(t).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? t.api.invalidData },
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
      { error: t.api.screenshotExtractFailed },
      { status: 422 },
    );
  }
});
