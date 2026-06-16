import { NextResponse } from "next/server";
import { ImportUrlSchema } from "@/lib/schemas/import";
import { extractRecipeFromUrl, ImportError } from "@/lib/import";
import { enforceImportQuota } from "@/lib/import-quota";
import { withHouseholdAuth } from "@/lib/api/with-household-auth";

export const POST = withHouseholdAuth(async (request: Request, _ctx, { householdId }) => {
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
