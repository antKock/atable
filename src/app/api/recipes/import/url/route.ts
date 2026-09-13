import { NextResponse } from "next/server";
import { buildImportUrlSchema } from "@/lib/schemas/import";
import { extractRecipeFromUrl, ImportError } from "@/lib/import";
import { enforceImportQuota } from "@/lib/import-quota";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { resolveImportHousehold } from "@/lib/api/import-household";
import { getT } from "@/lib/i18n/server";

export const POST = withOwnerAuth(async (request: Request, _ctx, owner) => {
  const t = await getT();
  const target = resolveImportHousehold(owner, t);
  if (target instanceof NextResponse) return target;
  const { householdId } = target;

  try {
    // Valider AVANT de consommer le quota : une URL invalide ne coûte rien.
    const body = await request.json().catch(() => null);
    const parsed = buildImportUrlSchema(t).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? t.validation.urlInvalid, code: "INVALID_DATA" },
        { status: 400 },
      );
    }

    const quotaResponse = await enforceImportQuota(householdId);
    if (quotaResponse) return quotaResponse;

    const formData = await extractRecipeFromUrl(parsed.data.url, { householdId });
    return NextResponse.json(formData);
  } catch (error) {
    console.error("[import/url] Error:", error);

    if (error instanceof ImportError) {
      const status =
        error.code === "SITE_BLOCKED" ? 422 : error.code === "TIMEOUT" ? 504 : 502;
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
}, {
  // Opt-out garde démo : extraction IA sans écriture (le visiteur démo importe
  // comme n'importe quel membre, sous le quota du foyer démo).
  allowDemoMutation: true,
});
