import { NextResponse } from "next/server";
import { ImportUrlSchema } from "@/lib/schemas/import";
import { extractRecipeFromUrl, ImportError } from "@/lib/import";
import { enforceImportQuota } from "@/lib/import-quota";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { memberHouseholdIds } from "@/lib/auth/owner-context";

export const POST = withOwnerAuth(async (request: Request, _ctx, owner) => {
  // L'import précède le choix du foyer de destination (dialog à l'enregistrement)
  // : le quota et l'attribution de coût IA se rattachent au premier foyer où
  // l'owner est MEMBRE (un invité — lecture seule — est refusé, Lot 3).
  const memberIds = memberHouseholdIds(owner);
  if (memberIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const householdId = memberIds[0];

  const quotaResponse = await enforceImportQuota(householdId);
  if (quotaResponse) return quotaResponse;

  try {
    const body = await request.json();
    const parsed = ImportUrlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "URL invalide" },
        { status: 400 },
      );
    }

    const formData = await extractRecipeFromUrl(parsed.data.url, { householdId });
    return NextResponse.json(formData);
  } catch (error) {
    console.error("[import/url] Error:", error);

    if (error instanceof ImportError) {
      const status = error.code === "SITE_BLOCKED" ? 422 : 502;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }

    // OpenAI SDK attaches status on rate-limit errors
    const apiStatus = (error as { status?: number }).status;
    if (apiStatus === 429) {
      return NextResponse.json(
        { error: "rate_limit", code: "RATE_LIMIT" },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "extraction_failed", code: "EXTRACTION_FAILED" },
      { status: 422 },
    );
  }
});
